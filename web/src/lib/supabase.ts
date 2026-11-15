// Cliente Supabase do browser. Só usa o URL e a chave pública (anon/publishable): a segurança
// está na RLS e nas funções da base de dados. Nenhuma chave secreta entra no frontend.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createDemoClient } from "./demo/client";
import { DEMO_MODE } from "./demoMode";

export { DEMO_MODE };

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!DEMO_MODE && (!url || !anonKey)) {
  // Mensagem para quem está a desenvolver; o utilizador final nunca chega a ver isto.
  console.error("Falta VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY (ver web/.env.example).");
}

export const supabase: SupabaseClient = DEMO_MODE
  ? (createDemoClient() as unknown as SupabaseClient)
  : createClient(url ?? "http://localhost:54321", anonKey ?? "missing-anon-key", {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Os links de email são tratados em /auth/confirmar com verifyOtp (token_hash).
      detectSessionInUrl: false,
    },
  });

export const SUPABASE_URL = DEMO_MODE ? "" : (url ?? "");

