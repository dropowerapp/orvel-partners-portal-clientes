// Convite (ou reenvio) de acesso a um cliente.
// Chamada pelo painel da equipa: POST { client_id } com o token da sessão do administrador.
//
// 1. Confirma quem chama (token) e que é equipa da organização do cliente COM MFA (is_staff_of
//    corre com o token do próprio utilizador, por isso a regra aal2 da base de dados aplica-se).
// 2. Cria a conta no Supabase Auth se ainda não existir (o registo público está desligado).
// 3. Gera um link de acesso de uso único e liga a conta ao cliente (membership).
// 4. Envia o email com a marca da organização. A chave de serviço nunca sai do servidor.
import { buildAuthEmail, confirmLink, type EmailMessage, type OrgBranding, portalUrl } from "../_shared/email.ts";
import { corsHeaders, dbErrorCode, errorResponse, isUuid, json } from "../_shared/http.ts";

export interface InviteEnv {
  PUBLIC_SITE_URL?: string;
  ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  AUTH_LINK_EXPIRY_HOURS?: string;
}

type RpcResult<T> = { data: T | null; error: { message: string } | null };

export interface InviteDeps {
  env: InviteEnv;
  /** Utilizador do token (null se inválido). */
  getActor(authorization: string): Promise<{ id: string } | null>;
  /** RPC com o token do utilizador (RLS e aal aplicam-se). */
  userRpc<T>(authorization: string, fn: string, args: Record<string, unknown>): Promise<RpcResult<T>>;
  /** RPC com a chave de serviço. */
  adminRpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>>;
  createAuthUser(email: string): Promise<{ id: string | null; error: string | null }>;
  generateMagicLinkHash(email: string): Promise<{ hashedToken: string | null; error: string | null }>;
  sendEmail(message: EmailMessage): Promise<void>;
}

interface PreparedInvite {
  client: {
    id: string;
    full_name: string;
    email: string;
    locale: string | null;
    user_id: string | null;
    invited_at: string | null;
  };
  organization: OrgBranding;
}

export async function handleInvite(req: Request, deps: InviteDeps): Promise<Response> {
  const cors = corsHeaders(req.headers.get("origin"), deps.env.ALLOWED_ORIGINS);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return errorResponse("method_not_allowed", 405, cors);

  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return errorResponse("not_authenticated", 401, cors);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid_request", 400, cors);
  }
  const clientId = (body as { client_id?: unknown })?.client_id;
  if (!isUuid(clientId)) return errorResponse("invalid_request", 400, cors);

  const actor = await deps.getActor(authorization);
  if (!actor) return errorResponse("not_authenticated", 401, cors);

  // Dados do cliente e da organização (confirma que o autor é administrador ativo).
  const prepared = await deps.adminRpc<PreparedInvite>("admin_prepare_invite", { p_client_id: clientId, p_actor: actor.id });
  if (prepared.error || !prepared.data) {
    const { code, status } = dbErrorCode(prepared.error?.message ?? "not_found");
    return errorResponse(code, status, cors);
  }
  const { client, organization } = prepared.data;

  // MFA: verificado com o token do próprio utilizador.
  const staff = await deps.userRpc<boolean>(authorization, "is_staff_of", { p_org: organization.id });
  if (staff.error) return errorResponse("server_error", 500, cors);
  if (staff.data !== true) return errorResponse("mfa_required", 403, cors);

  // Conta no Supabase Auth: a já ligada ao cliente, uma existente com o mesmo email, ou uma nova.
  let userId = client.user_id;
  if (!userId) {
    const existing = await deps.adminRpc<string>("admin_user_id_by_email", { p_email: client.email });
    if (existing.error) return errorResponse("server_error", 500, cors);
    userId = existing.data;
  }
  if (!userId) {
    const created = await deps.createAuthUser(client.email);
    if (created.error || !created.id) return errorResponse("server_error", 500, cors);
    userId = created.id;
  }

  const link = await deps.generateMagicLinkHash(client.email);
  if (link.error || !link.hashedToken) return errorResponse("server_error", 500, cors);

  const registered = await deps.adminRpc<null>("admin_register_invite", {
    p_client_id: client.id,
    p_user_id: userId,
    p_actor: actor.id,
  });
  if (registered.error) {
    const { code, status } = dbErrorCode(registered.error.message);
    return errorResponse(code, status, cors);
  }

  const locale = client.locale ?? organization.default_locale;
  const message = buildAuthEmail({
    kind: "invite",
    org: organization,
    locale,
    to: { email: client.email, name: client.full_name },
    link: confirmLink(portalUrl(organization, deps.env), link.hashedToken, "magiclink"),
    expiryHours: Number(deps.env.AUTH_LINK_EXPIRY_HOURS ?? "1") || 1,
    supabaseUrl: deps.env.SUPABASE_URL,
  });

  try {
    await deps.sendEmail(message);
  } catch (error) {
    console.error("invite-client: envio falhou", error instanceof Error ? error.message : error);
    return errorResponse("email_send_failed", 502, cors);
  }

  return json({ ok: true, resent: client.invited_at !== null }, 200, cors);
}
