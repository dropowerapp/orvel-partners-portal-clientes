import { timingSafeEqual } from "node:crypto";
import { errorResponse, isUuid, json } from "../_shared/http.ts";
import { isProcessStoragePath } from "../_shared/storage-path.ts";

export interface PurgeTarget { document_id: string; process_id: string; organization_id: string; storage_path: string }
export interface PurgeJob extends PurgeTarget { lease_id: string }
export interface PurgeDeps {
  env: { RETENTION_JOB_SECRET?: string; RETENTION_ENABLED?: string; RETENTION_ORGANIZATION_ID?: string };
  preview(org: string, limit: number): Promise<PurgeTarget[]>;
  claim(org: string, limit: number): Promise<PurgeJob[]>;
  remove(path: string): Promise<void>;
  finish(job: PurgeJob): Promise<void>;
  fail(job: PurgeJob, error: "invalid_path" | "storage_delete_failed" | "confirmation_failed"): Promise<void>;
}
const BATCH = 25;
const HEADERS = { "cache-control": "no-store" };

export async function handlePurgeDocuments(req: Request, deps: PurgeDeps): Promise<Response> {
  if (req.method !== "POST") return errorResponse("method_not_allowed", 405, HEADERS);
  const secret = deps.env.RETENTION_JOB_SECRET;
  if (!secret || secret.length < 32) return errorResponse("retention_not_configured", 503, HEADERS);
  const supplied = new TextEncoder().encode(req.headers.get("authorization") ?? "");
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return errorResponse("unauthorized", 401, HEADERS);
  }
  const org = deps.env.RETENTION_ORGANIZATION_ID;
  if (!isUuid(org)) return errorResponse("retention_not_configured", 503, HEADERS);
  let dryRun = true;
  try {
    const text = await req.text();
    if (text.length > 1024) return errorResponse("invalid_request", 400, HEADERS);
    const body = text ? JSON.parse(text) : {};
    if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some((key) => key !== "dry_run") ||
      (body.dry_run !== undefined && typeof body.dry_run !== "boolean")) return errorResponse("invalid_request", 400, HEADERS);
    dryRun = body.dry_run !== false;
  } catch { return errorResponse("invalid_request", 400, HEADERS); }
  if (!dryRun && deps.env.RETENTION_ENABLED !== "true") return errorResponse("retention_disabled", 409, HEADERS);

  try {
    if (dryRun) {
      const candidates = await deps.preview(org, BATCH + 1);
      return json({ dry_run: true, candidates: Math.min(candidates.length, BATCH), has_more: candidates.length > BATCH, limit: BATCH }, 200, HEADERS);
    }
    const jobs = await deps.claim(org, BATCH);
    let completed = 0;
    let failed = 0;
    for (const job of jobs) {
      let stage: "invalid_path" | "storage_delete_failed" | "confirmation_failed" = "invalid_path";
      try {
        if (job.organization_id !== org || !isProcessStoragePath(job.storage_path, org, job.process_id)) throw new Error("invalid_path");
        stage = "storage_delete_failed";
        await deps.remove(job.storage_path);
        stage = "confirmation_failed";
        await deps.finish(job);
        completed++;
      } catch {
        failed++;
        // Não expor mensagens do fornecedor, nomes de ficheiros ou caminhos nos logs/resposta.
        try { await deps.fail(job, stage); } catch { /* A reserva expira e permite nova tentativa. */ }
      }
    }
    return json({ dry_run: false, claimed: jobs.length, completed, failed, limit: BATCH }, failed ? 503 : 200, HEADERS);
  } catch { return errorResponse("retention_failed", 503, HEADERS); }
}
