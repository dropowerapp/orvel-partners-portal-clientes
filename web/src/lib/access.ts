// Decide o que mostrar a quem entra numa área do portal. Função pura (testada à parte); a
// base de dados aplica as mesmas regras na RLS, por isso isto é só para encaminhar o utilizador.
export interface SessionContext {
  role: "admin" | "client" | "partner" | null;
  client_id: string | null;
  mfa_required: boolean;
  consent_required: boolean;
  notice_missing: boolean;
  notice: { id: string; version: number; body: Record<string, string>; retention_days: number } | null;
}

export type Area = "client" | "staff";

export type AccessDecision =
  | { kind: "ok" }
  | { kind: "login" }
  | { kind: "mfa" }
  | { kind: "consent" }
  | { kind: "notice_missing" }
  | { kind: "no_access" }
  | { kind: "redirect"; to: string };

export const ROUTES = {
  clientLogin: "/entrar",
  clientHome: "/",
  privacy: "/privacidade",
  teamLogin: "/equipa/entrar",
  teamHome: "/equipa",
  mfa: "/equipa/mfa",
  noAccess: "/sem-acesso",
} as const;

export function decideAccess(
  area: Area,
  state: { hasSession: boolean; context: SessionContext | null; aal: "aal1" | "aal2" | null },
): AccessDecision {
  if (!state.hasSession) return { kind: "login" };
  const ctx = state.context;
  if (!ctx || ctx.role === null || ctx.role === "partner") return { kind: "no_access" };

  if (area === "client") {
    if (ctx.role === "admin") return { kind: "redirect", to: ROUTES.teamHome };
    if (ctx.notice_missing) return { kind: "notice_missing" };
    if (ctx.consent_required) return { kind: "consent" };
    return { kind: "ok" };
  }

  if (ctx.role === "client") return { kind: "redirect", to: ROUTES.clientHome };
  if (state.aal !== "aal2") return { kind: "mfa" };
  return { kind: "ok" };
}

/** Texto do aviso no idioma pedido (ou pt-PT), com o prazo de conservação inserido. */
export function noticeText(notice: NonNullable<SessionContext["notice"]>, locale: string): string {
  const body = notice.body[locale] ?? notice.body["pt-PT"] ?? Object.values(notice.body)[0] ?? "";
  return body.replaceAll("{retention_days}", String(notice.retention_days));
}

/** Só aceita caminhos internos como destino depois do login (evita redirecionamentos abertos). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
