// Abre um ficheiro privado com um URL assinado de 60 s.
import { functionErrorCode } from "./errors";
import { supabase } from "./supabase";

/** Abre a janela no clique para evitar o bloqueio de pop-ups e fecha-a se falhar. */
export async function openDownload(kind: "proposal" | "document", id: string): Promise<string | null> {
  const win = window.open("", "_blank");
  if (win) win.opener = null;
  try {
    const { data, error } = await supabase.functions.invoke("sign-download", { body: { kind, id } });
    const url = (data as { url?: string } | null)?.url;
    if (error || !url) {
      win?.close();
      return error ? await functionErrorCode(error) : "not_found";
    }
    if (win) win.location.href = url;
    else window.location.href = url;
    return null;
  } catch {
    win?.close();
    return "network";
  }
}
