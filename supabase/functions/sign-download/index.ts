// Edge Function sign-download (ver handler.ts). verify_jwt fica ligado (config.toml).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { handleSignDownload } from "./handler.ts";

const env = Deno.env.toObject();
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function userClient(authorization: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
}

Deno.serve((req) =>
  handleSignDownload(req, {
    env,
    async getActor(authorization) {
      const { data, error } = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
      return error || !data.user ? null : { id: data.user.id };
    },
    async findTarget(authorization, kind, id) {
      const db = userClient(authorization);
      if (kind === "proposal") {
        const { data } = await db.from("proposals").select("organization_id, process_id, pdf_path, reference").eq("id", id)
          .maybeSingle();
        if (!data) return null;
        return {
          organization_id: data.organization_id,
          process_id: data.process_id,
          path: data.pdf_path,
          file_name: `${data.reference}.pdf`,
          sensitive: false,
        };
      }
      const { data } = await db
        .from("documents")
        .select("organization_id, process_id, storage_path, file_name, is_sensitive, purged_at")
        .eq("id", id)
        .maybeSingle();
      if (!data || data.purged_at) return null;
      return {
        organization_id: data.organization_id,
        process_id: data.process_id,
        path: data.storage_path,
        file_name: data.file_name,
        sensitive: data.is_sensitive,
      };
    },
    async sign(path, seconds) {
      const { data, error } = await admin.storage.from("documents").createSignedUrl(path, seconds);
      return error ? null : data.signedUrl;
    },
    async logDownload(target, actorId, kind, id) {
      const { data: member } = await admin
        .from("memberships")
        .select("role")
        .eq("user_id", actorId)
        .eq("organization_id", target.organization_id)
        .maybeSingle();
      const { error } = await admin.from("activity_log").insert({
        organization_id: target.organization_id,
        process_id: target.process_id,
        actor_user_id: actorId,
        actor_role: member?.role ?? "unknown",
        action: "document.downloaded",
        entity_type: kind,
        entity_id: id,
      });
      if (error) throw new Error(error.message);
    },
  })
);
