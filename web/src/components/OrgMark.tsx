// Marca da organização no cabeçalho. Usa o ficheiro do logótipo quando existir (carregado nas
// definições); até lá mostra apenas o nome, sem tentar reproduzir o logótipo.
import { useOrg } from "../lib/OrgProvider";
import { logoUrl } from "../lib/org";
import { SUPABASE_URL } from "../lib/supabase";

export function OrgMark({ inverted = false }: { inverted?: boolean }) {
  const org = useOrg();
  const src = logoUrl(org, SUPABASE_URL);
  if (src) return <img src={src} alt={org.name} className="h-8 w-auto" />;
  return <span className={`text-lg font-semibold ${inverted ? "text-white" : "text-primary"}`}>{org.name}</span>;
}
