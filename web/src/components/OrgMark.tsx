// Marca da organização no cabeçalho: o ficheiro do logótipo, tal como foi carregado (nunca se
// redesenha). Sem ficheiro, ou se não carregar, mostra apenas o nome. Os cabeçalhos são claros
// porque os logótipos costumam ser feitos para fundo claro.
import { useState } from "react";
import { useOrg } from "../lib/OrgProvider";
import { orgLogoSrc } from "../lib/branding";

export function OrgMark({ className = "h-9 sm:h-10" }: { className?: string }) {
  const org = useOrg();
  const src = orgLogoSrc(org);
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt={org.name} className={`${className} w-auto`} onError={() => setFailed(true)} />;
  }
  return <span className="text-lg font-semibold text-primary">{org.name}</span>;
}
