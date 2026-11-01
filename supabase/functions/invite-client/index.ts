// Edge Function invite-client (ver handler.ts). verify_jwt fica ligado (config.toml).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { sendEmail } from "../_shared/email.ts";
import { handleInvite } from "./handler.ts";

const env = Deno.env.toObject();
const SUPABASE_URL = env.SUPABASE_URL;
const ANON_KEY = env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function userClient(authorization: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
}

Deno.serve((req) =>
  handleInvite(req, {
    env,
    async getActor(authorization) {
      const token = authorization.replace(/^Bearer\s+/i, "");
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id };
    },
    async userRpc(authorization, fn, args) {
      const { data, error } = await userClient(authorization).rpc(fn, args);
      return { data, error };
    },
    async adminRpc(fn, args) {
      const { data, error } = await admin.rpc(fn, args);
      return { data, error };
    },
    async createAuthUser(email) {
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      return { id: data.user?.id ?? null, error: error?.message ?? null };
    },
    async generateMagicLinkHash(email) {
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      return { hashedToken: data?.properties?.hashed_token ?? null, error: error?.message ?? null };
    },
    sendEmail: (message) => sendEmail(message, env),
  })
);
