// Organização do portal, escolhida pelo hostname (white label). Em desenvolvimento pode
// escolher-se outra com ?org=slug (fica guardada na sessão do browser).
import type { OrgTheme } from "./theme";

export interface PublicOrg {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  theme: OrgTheme | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  default_locale: string;
}

const DEV_KEY = "portal.dev-org";
const SLUG = /^[a-z0-9-]{1,60}$/;

export function resolveOrgKey(
  location: Pick<Location, "hostname" | "search">,
  isDev: boolean,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof sessionStorage === "undefined" ? null : sessionStorage,
): string {
  if (isDev) {
    const fromQuery = new URLSearchParams(location.search).get("org");
    if (fromQuery && SLUG.test(fromQuery)) {
      storage?.setItem(DEV_KEY, fromQuery);
      return fromQuery;
    }
    const saved = storage?.getItem(DEV_KEY);
    if (saved && SLUG.test(saved)) return saved;
  }
  return location.hostname.toLowerCase();
}

/** URL público de um ficheiro do bucket "branding" (logótipo, símbolo). */
export function brandingUrl(path: string | null | undefined, supabaseUrl: string): string | null {
  if (!path || !supabaseUrl) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/branding/${encoded}`;
}

export function logoUrl(org: Pick<PublicOrg, "logo_path">, supabaseUrl: string): string | null {
  return brandingUrl(org.logo_path, supabaseUrl);
}

/** Símbolo da organização (ex.: a esfera da Orvel), usado no painel de entrada e no ícone do separador. */
export function symbolUrl(org: Pick<PublicOrg, "theme">, supabaseUrl: string): string | null {
  return brandingUrl(org.theme?.symbol_path, supabaseUrl);
}
