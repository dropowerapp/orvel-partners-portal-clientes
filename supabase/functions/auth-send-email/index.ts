// Edge Function auth-send-email (ver handler.ts). verify_jwt fica desligado (config.toml): quem
// chama é o Supabase Auth, autenticado pela assinatura SEND_EMAIL_HOOK_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { Webhook } from "npm:standardwebhooks@1.1.1";
import { sendEmail } from "../_shared/email.ts";
import { handleSendEmailHook, type HookPayload } from "./handler.ts";

const env = Deno.env.toObject();
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// O segredo vem no formato "v1,whsec_<base64>"; a biblioteca quer só a parte base64.
const webhook = new Webhook((env.SEND_EMAIL_HOOK_SECRET ?? "").replace(/^v1,whsec_/, ""));

Deno.serve((req) =>
  handleSendEmailHook(req, {
    env,
    verify: (raw, headers) => webhook.verify(raw, headers) as HookPayload,
    async emailContext(userId, host) {
      const { data, error } = await admin.rpc("admin_email_context", { p_user_id: userId, p_host: host });
      return { data, error };
    },
    sendEmail: (message) => sendEmail(message, env),
  })
);
