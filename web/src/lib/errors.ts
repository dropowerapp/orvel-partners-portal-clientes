// Códigos de erro estáveis → chave de tradução (errors.*).
import ptPT from "../i18n/pt-PT.json";

const KNOWN = new Set(Object.keys(ptPT.errors));

interface MaybeError {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
}

/** Extrai o código de um erro do Supabase (Auth, PostgREST ou função) ou de rede. */
export function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "generic";
  const e = error as MaybeError;
  if (typeof e.code === "string" && KNOWN.has(e.code)) return e.code;
  if (typeof e.message === "string" && KNOWN.has(e.message.trim())) return e.message.trim();
  if (e.name === "AuthRetryableFetchError" || e.name === "FunctionsFetchError" || e.message === "Failed to fetch") {
    return "network";
  }
  if (e.status === 429) return "over_request_rate_limit";
  return "generic";
}

export function errorKey(error: unknown): string {
  return `errors.${errorCode(error)}`;
}

/** Erros das Edge Functions vêm no corpo da resposta: { "error": "codigo" }. */
export async function functionErrorCode(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body.error === "string" && KNOWN.has(body.error)) return body.error;
    } catch {
      // corpo sem JSON
    }
  }
  return errorCode(error);
}
