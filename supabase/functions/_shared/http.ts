// Respostas HTTP e CORS das Edge Functions chamadas pelo portal.

export function corsHeaders(origin: string | null, allowedOrigins: string | undefined): Record<string, string> {
  const allowed = (allowedOrigins ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  const allowOrigin = allowed.length === 0 ? "*" : origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

/** Resposta JSON. Os erros usam códigos estáveis (traduzidos no frontend). */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function errorResponse(code: string, status: number, headers: Record<string, string> = {}): Response {
  return json({ error: code }, status, headers);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Códigos de erro da base de dados (raise exception 'codigo') que podem chegar ao portal. */
const KNOWN_DB_ERRORS: Record<string, number> = {
  not_found: 404,
  invite_too_soon: 429,
  membership_inactive: 409,
  client_linked_to_other_user: 409,
  membership_conflict: 409,
};

export function dbErrorCode(message: string | undefined): { code: string; status: number } {
  const code = (message ?? "").trim();
  return code in KNOWN_DB_ERRORS ? { code, status: KNOWN_DB_ERRORS[code] } : { code: "server_error", status: 500 };
}
