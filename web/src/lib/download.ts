// Abre um ficheiro do bucket privado com um URL assinado de 60 s (Edge Function sign-download).
import { functionErrorCode } from "./errors";
import { supabase } from "./supabase";

/**
 * A janela abre-se já no clique (senão o browser bloqueia-a) e recebe o endereço depois.
 * Devolve o código de erro, ou null se correu bem.
 */
export async function openDownload(kind: "proposal" | "document", id: string): Promise<string | null> {
  const win = window.open("", "_blank");
  const { data, error } = await supabase.functions.invoke("sign-download", { body: { kind, id } });
  const url = (data as { url?: string } | null)?.url;
  if (error || !url) {
    win?.close();
    return error ? await functionErrorCode(error) : "not_found";
  }
  if (win) win.location.href = url;
  else window.location.href = url;
  return null;
}
