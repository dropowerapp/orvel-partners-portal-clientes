// Endereços do logótipo e do símbolo da organização (bucket público "branding" do Supabase).
// Na demonstração os dados fictícios já trazem endereços locais.
import { DEMO_MODE } from "./demoMode";
import { logoDarkUrl, logoUrl, type PublicOrg, symbolUrl } from "./org";
import { SUPABASE_URL } from "./supabase";

export function orgLogoSrc(org: Pick<PublicOrg, "logo_path">): string | null {
  return DEMO_MODE ? org.logo_path : logoUrl(org, SUPABASE_URL);
}

export function orgSymbolSrc(org: Pick<PublicOrg, "theme">): string | null {
  return DEMO_MODE ? (org.theme?.symbol_path ?? null) : symbolUrl(org, SUPABASE_URL);
}

export function orgLogoDarkSrc(org: Pick<PublicOrg, "theme">): string | null {
  return DEMO_MODE ? (org.theme?.logo_dark_path ?? null) : logoDarkUrl(org, SUPABASE_URL);
}
