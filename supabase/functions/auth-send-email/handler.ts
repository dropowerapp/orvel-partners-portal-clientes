// Hook "Send Email" do Supabase Auth: os emails de login (link mágico) e de recuperação de
// password saem pela Brevo com a marca da organização, em vez dos modelos genéricos do Supabase.
//
// O Supabase Auth assina cada pedido (Standard Webhooks); pedidos sem assinatura válida são
// recusados. O link aponta para /auth/confirmar no portal, que conclui o login com verifyOtp.
import {
  type AuthEmailKind,
  buildAuthEmail,
  confirmLink,
  type EmailMessage,
  type OrgBranding,
  portalUrl,
} from "../_shared/email.ts";
import { json } from "../_shared/http.ts";

export interface HookEnv {
  PUBLIC_SITE_URL?: string;
  SUPABASE_URL?: string;
  AUTH_LINK_EXPIRY_HOURS?: string;
}

export interface HookPayload {
  user: { id: string; email: string; user_metadata?: Record<string, unknown> };
  email_data: {
    token?: string;
    token_hash: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
  };
}

interface EmailContext {
  role: string | null;
  locale: string | null;
  organization: OrgBranding;
  full_name?: string | null;
}

export interface HookDeps {
  env: HookEnv;
  /** Valida a assinatura e devolve o payload (lança erro se inválida). */
  verify(rawBody: string, headers: Record<string, string>): HookPayload;
  emailContext(userId: string, host: string | null): Promise<{ data: EmailContext | null; error: { message: string } | null }>;
  sendEmail(message: EmailMessage): Promise<void>;
}

// Tipo de email do Supabase → modelo e tipo usado no verifyOtp.
const KINDS: Record<string, { kind: AuthEmailKind; otpType: string }> = {
  magiclink: { kind: "magiclink", otpType: "magiclink" },
  email: { kind: "magiclink", otpType: "magiclink" },
  recovery: { kind: "recovery", otpType: "recovery" },
  invite: { kind: "invite", otpType: "invite" },
};

function hookError(status: number, message: string): Response {
  return json({ error: { http_code: status, message } }, status);
}

function safeHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function safeOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export async function handleSendEmailHook(req: Request, deps: HookDeps): Promise<Response> {
  if (req.method !== "POST") return hookError(405, "method_not_allowed");

  const raw = await req.text();
  let payload: HookPayload;
  try {
    payload = deps.verify(raw, Object.fromEntries(req.headers));
  } catch {
    return hookError(401, "invalid_signature");
  }

  const action = payload.email_data?.email_action_type;
  const mapping = KINDS[action];
  if (!mapping) {
    // O portal não usa outros tipos (ex.: alteração de email). Recusar em vez de enviar algo errado.
    return hookError(400, `unsupported_email_action:${action}`);
  }

  // A organização do utilizador, de preferência a do portal onde o pedido foi feito.
  const host = safeHost(payload.email_data.redirect_to);
  const context = await deps.emailContext(payload.user.id, host);
  if (context.error) return hookError(500, "context_failed");
  if (!context.data) {
    // Conta sem acesso a nenhuma organização: não envia nada (e não revela isso a quem pediu).
    console.warn("auth-send-email: utilizador sem organização, email não enviado");
    return json({});
  }

  const { organization, locale } = context.data;

  // O Supabase Auth só aceita redirect_to dentro da lista de URLs permitidos, por isso a origem é
  // de confiança; sem ela, usa o endereço do portal da organização.
  const base = safeOrigin(payload.email_data.redirect_to) ?? portalUrl(organization, deps.env);

  const message = buildAuthEmail({
    kind: mapping.kind,
    org: organization,
    locale,
    to: { email: payload.user.email, name: context.data.full_name ?? null },
    link: confirmLink(base, payload.email_data.token_hash, mapping.otpType),
    expiryHours: Number(deps.env.AUTH_LINK_EXPIRY_HOURS ?? "1") || 1,
    supabaseUrl: deps.env.SUPABASE_URL,
  });

  try {
    await deps.sendEmail(message);
  } catch (error) {
    console.error("auth-send-email: envio falhou", error instanceof Error ? error.message : error);
    return hookError(502, "email_send_failed");
  }
  return json({});
}
