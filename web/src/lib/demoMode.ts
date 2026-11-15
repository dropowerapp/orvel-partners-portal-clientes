/**
 * Modo de demonstração: Supabase simulado com dados fictícios, para ver os ecrãs sem projeto
 * Supabase.
 * - Servidor de desenvolvimento: `npm run web:demo`.
 * - Build: só se a variável VITE_DEMO_MODE=true estiver definida no momento do build (na Vercel,
 *   apenas no ambiente Preview, nunca em Production). Sem ela, esta condição é sempre falsa e o
 *   código da demonstração não entra no pacote.
 */
export const DEMO_MODE = (import.meta.env.DEV && import.meta.env.MODE === "demo") ||
  import.meta.env.VITE_DEMO_MODE === "true";
