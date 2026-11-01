// Cliente Supabase do browser. Só usa o URL e a chave pública (anon/publishable): a segurança
// está na RLS e nas funções da base de dados. Nenhuma chave secreta entra no frontend.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Mensagem para quem está a desenvolver; o utilizador final nunca chega a ver isto.
  console.error("Falta VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY (ver web/.env.example).");
}

export const supabase = createClient(url ?? "http://localhost:54321", anonKey ?? "missing-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Os links de email são tratados em /auth/confirmar com verifyOtp (token_hash).
    detectSessionInUrl: false,
  },
});

export const SUPABASE_URL = url ?? "";
