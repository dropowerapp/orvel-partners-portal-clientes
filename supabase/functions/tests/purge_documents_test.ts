import { assertEquals } from "jsr:@std/assert@1";
import { handlePurgeDocuments, type PurgeDeps, type PurgeJob } from "../purge-documents/handler.ts";

const ORG = "11111111-1111-4111-8111-111111111111";
const PROCESS = "22222222-2222-4222-8222-222222222222";
const SECRET = "segredo-ficticio-apenas-para-testes-123456789";
const JOB: PurgeJob = { document_id: "documento", process_id: PROCESS, organization_id: ORG,
  storage_path: `${ORG}/${PROCESS}/uploads/pedido/passaporte.pdf`, lease_id: "reserva" };
function setup(over: Partial<PurgeDeps> = {}) {
  const calls: string[] = [];
  const deps: PurgeDeps = {
    env: { RETENTION_JOB_SECRET: SECRET, RETENTION_ORGANIZATION_ID: ORG },
    preview: async (org) => { calls.push(`preview:${org}`); return [JOB]; },
    claim: async () => { calls.push("claim"); return [JOB]; },
    remove: async () => { calls.push("remove"); },
    finish: async () => { calls.push("finish"); },
    fail: async (_job, error) => { calls.push(error); },
    ...over,
  };
  return { deps, calls };
}
function req(body: unknown = {}, authorization = `Bearer ${SECRET}`) {
  return new Request("https://portal.exemplo.test/purge-documents", {
    method: "POST", headers: { authorization }, body: JSON.stringify(body),
  });
}
const enabled = { RETENTION_JOB_SECRET: SECRET, RETENTION_ORGANIZATION_ID: ORG, RETENTION_ENABLED: "true" };

Deno.test("retenção: sem segredo válido não lê nem elimina", async () => {
  const { deps, calls } = setup();
  assertEquals((await handlePurgeDocuments(req({}, "Bearer token-de-cliente"), deps)).status, 401);
  assertEquals((await handlePurgeDocuments(req(), { ...deps, env: {} })).status, 503);
  assertEquals(calls, []);
});
Deno.test("retenção: simulação por omissão não reserva nem expõe caminhos", async () => {
  const { deps, calls } = setup();
  const response = await handlePurgeDocuments(req(), deps);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { dry_run: true, candidates: 1, has_more: false, limit: 25 });
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(calls, [`preview:${ORG}`]);
});
Deno.test("retenção: eliminação desligada até configuração explícita", async () => {
  const { deps, calls } = setup();
  assertEquals((await handlePurgeDocuments(req({ dry_run: false }), deps)).status, 409);
  assertEquals(calls, []);
});
Deno.test("retenção: recusa corpo inválido ou tentativa de escolher outro alvo", async () => {
  const { deps, calls } = setup();
  for (const body of [{ dry_run: "false" }, { organization_id: "outra" }, null, []]) {
    assertEquals((await handlePurgeDocuments(req(body), deps)).status, 400);
  }
  assertEquals(calls, []);
});
Deno.test("retenção: só confirma metadados depois de apagar pelo Storage", async () => {
  const { deps, calls } = setup({ env: enabled });
  const response = await handlePurgeDocuments(req({ dry_run: false }), deps);
  assertEquals(response.status, 200);
  assertEquals(calls, ["claim", "remove", "finish"]);
  assertEquals(await response.json(), { dry_run: false, claimed: 1, completed: 1, failed: 0, limit: 25 });
});
Deno.test("retenção: erro do Storage conserva o registo e agenda nova tentativa", async () => {
  const { deps, calls } = setup({ env: enabled, remove: async () => { throw new Error("dados privados do fornecedor"); } });
  const response = await handlePurgeDocuments(req({ dry_run: false }), deps);
  assertEquals(response.status, 503);
  assertEquals(calls, ["claim", "storage_delete_failed"]);
  assertEquals((await response.text()).includes("dados privados"), false);
});
Deno.test("retenção: confirmação falhada é repetível sem afirmar sucesso", async () => {
  const { deps, calls } = setup({ env: enabled, finish: async () => { throw new Error("indisponível"); } });
  const response = await handlePurgeDocuments(req({ dry_run: false }), deps);
  assertEquals(response.status, 503);
  assertEquals(calls, ["claim", "remove", "confirmation_failed"]);
});
Deno.test("retenção: recusa ficheiros de outra organização ou processo", async () => {
  for (const storage_path of [`outra/${PROCESS}/uploads/x.pdf`, `${ORG}/outro/uploads/x.pdf`, `${ORG}/${PROCESS}/../x.pdf`]) {
    const { deps, calls } = setup({ env: enabled, claim: async () => [{ ...JOB, storage_path }] });
    assertEquals((await handlePurgeDocuments(req({ dry_run: false }), deps)).status, 503);
    assertEquals(calls, ["invalid_path"]);
  }
});
