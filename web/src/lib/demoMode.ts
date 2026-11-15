/**
 * Modo de demonstração: Supabase simulado com dados fictícios, para ver os ecrãs sem projeto
 * Supabase (`npm run web:demo`). Só existe no servidor de desenvolvimento; no build esta condição é
 * sempre falsa e o código da demonstração não entra no pacote.
 */
export const DEMO_MODE = import.meta.env.DEV &&
  (import.meta.env.MODE === "demo" || import.meta.env.VITE_DEMO_MODE === "true");
