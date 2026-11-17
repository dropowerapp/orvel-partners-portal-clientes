// Download de ficheiros do bucket privado "documents": devolve um URL assinado válido 60 s.
// Chamada pelo portal: POST { kind: "proposal" | "document", id } com o token da sessão.
//
// 1. Lê o registo COM O TOKEN DO UTILIZADOR: a RLS decide se ele o pode ver (cliente: as suas
//    propostas enviadas e os seus documentos; equipa com MFA: tudo da organização).
// 2. Só depois cria o URL assinado com a chave de serviço (que nunca sai do servidor).
// 3. Downloads de documentos sensíveis ficam registados na atividade do processo.
import { corsHeaders, errorResponse, isUuid, json } from "../_shared/http.ts";

export const SIGNED_URL_SECONDS = 60;

export type DownloadKind = "proposal" | "document";

export interface DownloadTarget {
  organization_id: string;
  process_id: string;
  path: string | null;
  file_name: string;
  sensitive: boolean;
}

export interface SignEnv {
  ALLOWED_ORIGINS?: string;
}

export interface SignDeps {
  env: SignEnv;
  getActor(authorization: string): Promise<{ id: string } | null>;
  /** Registo visível para o utilizador (RLS), ou null. */
  findTarget(authorization: string, kind: DownloadKind, id: string): Promise<DownloadTarget | null>;
  sign(path: string, seconds: number): Promise<string | null>;
  logDownload(target: DownloadTarget, actorId: string, kind: DownloadKind, id: string): Promise<void>;
}

export async function handleSignDownload(req: Request, deps: SignDeps): Promise<Response> {
  const cors = corsHeaders(req.headers.get("origin"), deps.env.ALLOWED_ORIGINS);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return errorResponse("method_not_allowed", 405, cors);

  const authorization = req.headers.get("authorization") ?? "";
  const actor = authorization ? await deps.getActor(authorization) : null;
  if (!actor) return errorResponse("session_expired", 401, cors);

  let body: { kind?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid_request", 400, cors);
  }
  const kind = body.kind;
  if ((kind !== "proposal" && kind !== "document") || !isUuid(body.id)) return errorResponse("invalid_request", 400, cors);

  const target = await deps.findTarget(authorization, kind, body.id);
  if (!target || !target.path) return errorResponse("not_found", 404, cors);

  const url = await deps.sign(target.path, SIGNED_URL_SECONDS);
  if (!url) return errorResponse("not_found", 404, cors);

  if (target.sensitive) {
    try {
      await deps.logDownload(target, actor.id, kind, body.id);
    } catch (error) {
      // Sem registo não há download de um ficheiro sensível.
      console.error("sign-download: registo falhou", error instanceof Error ? error.message : error);
      return errorResponse("server_error", 500, cors);
    }
  }

  return json({ url, file_name: target.file_name, expires_in: SIGNED_URL_SECONDS }, 200, cors);
}
