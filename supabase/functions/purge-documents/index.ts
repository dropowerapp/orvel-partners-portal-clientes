import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { handlePurgeDocuments, type PurgeJob, type PurgeTarget } from "./handler.ts";

const env = Deno.env.toObject();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error("retention_database_failed");
  return data as T;
}
Deno.serve((req) => handlePurgeDocuments(req, {
  env,
  preview: (org, limit) => rpc<PurgeTarget[]>("admin_preview_document_purges", { p_org: org, p_limit: limit }),
  claim: (org, limit) => rpc<PurgeJob[]>("admin_claim_document_purges", { p_org: org, p_limit: limit }),
  async remove(path) {
    const { error } = await db.storage.from("documents").remove([path]);
    if (error) throw new Error("storage_delete_failed");
  },
  finish: (job) => rpc<void>("admin_finish_document_purge", { p_document_id: job.document_id, p_lease_id: job.lease_id }),
  fail: (job, error) => rpc<void>("admin_fail_document_purge", { p_document_id: job.document_id, p_lease_id: job.lease_id, p_error: error }),
}));
