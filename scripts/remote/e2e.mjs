// Teste de ponta a ponta contra o projeto Supabase de DESENVOLVIMENTO (dados fictícios do seed).
// Corre com scripts/remote/e2e.sh, que fornece as chaves por variáveis de ambiente.
//
// Cobre: registo público desligado, link mágico do cliente (hook auth-send-email em modo log),
// consentimento exigido pela base de dados, login da equipa com password e MFA (TOTP), convite
// (invite-client), políticas do Storage e a regra "o cliente nunca vê nomes da equipa".
// No fim desfaz o que alterou (exceto o cliente de teste do convite, que fica como dado fictício).
import { createHash, createHmac } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const env = process.env;
const URL_ = need("SUPABASE_URL");
const ANON = need("SUPABASE_ANON_KEY");
const SERVICE = need("SUPABASE_SERVICE_ROLE_KEY");
const REF = need("SUPABASE_PROJECT_REF");
const SITE_URL = (env.SITE_URL ?? "http://localhost:5173").replace(/\/+$/, "");
const PASSWORD = env.SEED_TEAM_PASSWORD ?? "Orvel-Local-2026!";
const MGMT = env.SUPABASE_API_URL ?? "https://api.supabase.com";

function need(name) {
  if (!env[name]) throw new Error(`Falta a variável ${name}`);
  return env[name];
}

// ------------------------------------------------------------------------------------------------
// Utilitários

const results = [];
async function check(name, fn) {
  try {
    const value = await fn();
    if (value === false) throw new Error("condição falsa");
    results.push({ ok: true, name });
    console.log(`✓ ${name}`);
    return value;
  } catch (error) {
    results.push({ ok: false, name, error: error.message });
    console.log(`✗ ${name} — ${error.message}`);
    return undefined;
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
function noError(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message ?? JSON.stringify(res.error)}`);
  return res.data;
}

/** Igual a md5('texto')::uuid no Postgres (ids determinísticos do seed). */
function seedId(text) {
  const h = createHash("md5").update(text).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function client() {
  return createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

/** Código TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) a partir do segredo em base32. */
function totp(secret, offset = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30) + offset));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const o = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Lê os emails escritos no log (EMAIL_MODE=log) pela Management API, à espera até 120 s. */
async function waitForEmail(to, since) {
  const sql = "select timestamp, event_message from function_logs " +
    "where regexp_contains(event_message, 'email:log') order by timestamp desc limit 50";
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const qs = new URLSearchParams({
      sql,
      iso_timestamp_start: new Date(since - 60_000).toISOString(),
      iso_timestamp_end: new Date(Date.now() + 60_000).toISOString(),
    });
    const headers = env.SUPABASE_ACCESS_TOKEN ? { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } : {};
    const res = await fetch(`${MGMT}/v1/projects/${REF}/analytics/endpoints/logs.all?${qs}`, { headers });
    if (res.ok) {
      const body = await res.json();
      const hit = (body.result ?? []).find((r) => String(r.event_message).includes(`[email:log] to=${to} `));
      if (hit) return String(hit.event_message);
    } else if (res.status !== 429) {
      throw new Error(`logs: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`email para ${to} não apareceu no log em 120 s`);
}

function linkFrom(message) {
  const match = message.match(/https?:\/\/\S+\/auth\/confirmar\?\S+/);
  assert(match, "o email não tem link /auth/confirmar");
  return new URL(match[0]);
}

/** Verifica o que o cliente nunca pode ver num email ou resposta. */
function assertNoInternalNames(text, where) {
  for (const forbidden of ["Best Tax", "Equipa (teste)", "Parceiro Exemplo", "Beneficiário Fictício"]) {
    assert(!text.includes(forbidden), `${where} contém "${forbidden}"`);
  }
}

async function callFunction(name, { token, body, origin = SITE_URL } = {}) {
  const headers = { "content-type": "application/json", apikey: ANON, origin };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${URL_}/functions/v1/${name}`, { method: "POST", headers, body: JSON.stringify(body ?? {}) });
  let json = null;
  try {
    json = await res.json();
  } catch { /* sem corpo JSON */ }
  return { status: res.status, json, headers: res.headers };
}

const pdf = (extra = "") => new Blob([`%PDF-1.4\n% ficheiro de teste fictício ${extra}\n%%EOF\n`], { type: "application/pdf" });

// ------------------------------------------------------------------------------------------------
// Dados do seed

const ids = {
  orvel: null,
  exemplo: seedId("seed:org-exemplo"),
  procRui: seedId("seed:proc-rui"),
  procMarta: seedId("seed:proc-marta"),
  clientRui: seedId("seed:client-rui"),
  clientCarla: seedId("seed:client-carla"),
  userRui: seedId("seed:rui.ficticio@exemplo.test"),
  userTeam: seedId("seed:equipa@exemplo.test"),
};
const cleanup = { objects: [], documents: [], requestsToReset: [], factors: [] };

console.log(`Projeto: ${URL_}\nPortal: ${SITE_URL}\n`);

ids.orvel = noError(await admin.from("organizations").select("id").eq("slug", "orvel").single(), "organização Orvel").id;

// ------------------------------------------------------------------------------------------------
console.log("— Sem sessão");
const anon = client();

await check("marca pública da organização por hostname (sem dados internos)", async () => {
  const org = noError(await anon.rpc("get_org_public", { p_host: "localhost" }), "get_org_public");
  assert(org?.name === "Orvel Partners", `nome inesperado: ${org?.name}`);
  assertNoInternalNames(JSON.stringify(org), "get_org_public");
  assert(!("team_notification_email" in org) && !("partner_role_enabled" in org), "devolve campos internos");
});
await check("anónimo não lê processos", async () => {
  const res = await anon.from("processes").select("id");
  assert(res.error || res.data.length === 0, "devolveu processos");
});
await check("registo público desligado (signUp recusado)", async () => {
  const res = await anon.auth.signUp({ email: `registo.${Date.now()}@exemplo.test`, password: "Registo-Teste-2026" });
  assert(res.error, "signUp foi aceite");
});
await check("link mágico para email desconhecido não cria conta", async () => {
  const email = `desconhecido.${Date.now()}@exemplo.test`;
  await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  const users = noError(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), "listUsers").users;
  assert(!users.some((u) => u.email === email), "a conta foi criada");
});
await check("hook auth-send-email recusa pedidos sem assinatura", async () => {
  const res = await callFunction("auth-send-email", { body: { user: {}, email_data: {} } });
  assert(res.status === 401, `HTTP ${res.status}`);
});

// ------------------------------------------------------------------------------------------------
console.log("\n— Cliente por link mágico (Rui, ainda sem consentimento)");
noError(await admin.from("privacy_consents").delete().eq("user_id", ids.userRui), "repor consentimento do Rui");
const rui = client();
let ruiNoticeId = null;

const ruiSince = Date.now();
await check("pedido de link mágico aceite", async () => {
  noError(
    await rui.auth.signInWithOtp({
      email: "rui.ficticio@exemplo.test",
      options: { shouldCreateUser: false, emailRedirectTo: `${SITE_URL}/auth/confirmar` },
    }),
    "signInWithOtp",
  );
});
const ruiEmail = await check("email do link mágico enviado pelo hook (log da função)", () => waitForEmail("rui.ficticio@exemplo.test", ruiSince));
let ruiLink = null;
if (ruiEmail) {
  await check("email com a marca e assinatura da organização, sem nomes internos", () => {
    assert(ruiEmail.includes("Equipa Orvel Partners"), "sem a assinatura \"Equipa Orvel Partners\"");
    assertNoInternalNames(ruiEmail, "email");
  });
  ruiLink = await check("link aponta para /auth/confirmar do portal (type=magiclink)", () => {
    const link = linkFrom(ruiEmail);
    assert(link.origin === SITE_URL, `origem ${link.origin}`);
    assert(link.searchParams.get("type") === "magiclink" && link.searchParams.get("token_hash"), "parâmetros em falta");
    return link;
  });
}
await check("link mágico inicia sessão (verifyOtp)", async () => {
  assert(ruiLink, "sem link");
  const data = noError(
    await rui.auth.verifyOtp({ token_hash: ruiLink.searchParams.get("token_hash"), type: "magiclink" }),
    "verifyOtp",
  );
  assert(data.session?.user?.email === "rui.ficticio@exemplo.test", "sessão de outro utilizador");
});
await check("contexto: cliente com consentimento em falta e aviso em vigor", async () => {
  const ctx = noError(await rui.rpc("get_session_context", { p_org: ids.orvel }), "get_session_context");
  assert(ctx.role === "client" && ctx.consent_required === true && ctx.notice?.id, JSON.stringify(ctx));
  assert(ctx.notice.retention_days === 30, "sem o prazo de conservação");
  ruiNoticeId = ctx.notice.id;
});
for (const table of ["processes", "clients", "documents", "payments", "proposals", "document_requests"]) {
  await check(`sem consentimento não vê ${table}`, async () => {
    const res = await rui.from(table).select("id");
    assert(!res.error && res.data.length === 0, res.error?.message ?? `${res.data.length} linhas`);
  });
}
const ruiRequest = noError(
  await admin.from("document_requests").select("id").eq("process_id", ids.procRui).eq("status", "pending").limit(1).single(),
  "pedido pendente do Rui",
).id;
const ruiUploadPath = `${ids.orvel}/${ids.procRui}/uploads/${ruiRequest}/e2e-passaporte.pdf`;
await check("sem consentimento não carrega ficheiros", async () => {
  const res = await rui.storage.from("documents").upload(ruiUploadPath, pdf("sem consentimento"), { contentType: "application/pdf" });
  if (!res.error) cleanup.objects.push(ruiUploadPath);
  assert(res.error, "o upload foi aceite");
});
await check("aceita o aviso de privacidade", async () => {
  noError(await rui.rpc("accept_privacy_notice", { p_notice_id: ruiNoticeId, p_user_agent: "teste e2e" }), "accept_privacy_notice");
  const ctx = noError(await rui.rpc("get_session_context", { p_org: ids.orvel }), "get_session_context");
  assert(ctx.consent_required === false, "continua a pedir consentimento");
});
await check("depois de aceitar, vê só o seu processo e os seus dados", async () => {
  const procs = noError(await rui.from("processes").select("id"), "processes");
  assert(procs.length === 1 && procs[0].id === ids.procRui, `${procs.length} processos`);
  const clients = noError(await rui.from("clients").select("id"), "clients");
  assert(clients.length === 1 && clients[0].id === ids.clientRui, `${clients.length} clientes`);
});
for (const table of ["process_internal", "internal_notes", "partners", "activity_log", "email_outbox", "partner_assignments"]) {
  await check(`cliente não lê ${table}`, async () => {
    const res = await rui.from(table).select("*");
    assert(res.error || res.data.length === 0, `${res.data?.length} linhas`);
  });
}
await check("cliente não vê nomes da equipa (memberships, propostas, cronologia)", async () => {
  const members = noError(await rui.from("memberships").select("*"), "memberships");
  assert(members.length === 1 && members[0].user_id === ids.userRui, `${members.length} memberships`);
  const dump = JSON.stringify([
    members,
    noError(await rui.from("proposals").select("*"), "proposals"),
    noError(await rui.from("timeline_steps").select("*"), "timeline_steps"),
    noError(await rui.rpc("get_org_public", { p_host: "localhost" }), "get_org_public"),
  ]);
  assertNoInternalNames(dump, "dados do cliente");
});

console.log("\n— Storage (cliente)");
await check("carrega PDF para um pedido seu pendente", async () => {
  noError(await rui.storage.from("documents").upload(ruiUploadPath, pdf("cliente"), { contentType: "application/pdf" }), "upload");
  cleanup.objects.push(ruiUploadPath);
});
await check("não carrega para o processo de outro cliente", async () => {
  const req = noError(await admin.from("document_requests").select("id").eq("process_id", ids.procMarta).limit(1).single(), "pedido").id;
  const path = `${ids.orvel}/${ids.procMarta}/uploads/${req}/e2e-intruso.pdf`;
  const res = await rui.storage.from("documents").upload(path, pdf("intruso"), { contentType: "application/pdf" });
  if (!res.error) cleanup.objects.push(path);
  assert(res.error, "o upload foi aceite");
});
await check("não carrega fora da pasta de uploads (ex.: emitidos)", async () => {
  const path = `${ids.orvel}/${ids.procRui}/issued/e2e-falso.pdf`;
  const res = await rui.storage.from("documents").upload(path, pdf("falso"), { contentType: "application/pdf" });
  if (!res.error) cleanup.objects.push(path);
  assert(res.error, "o upload foi aceite");
});
await check("recusa tipos de ficheiro não permitidos (texto)", async () => {
  const path = `${ids.orvel}/${ids.procRui}/uploads/${ruiRequest}/e2e-texto.txt`;
  const res = await rui.storage.from("documents").upload(path, new Blob(["texto"], { type: "text/plain" }), { contentType: "text/plain" });
  if (!res.error) cleanup.objects.push(path);
  assert(res.error, "o upload foi aceite");
});
await check("recusa ficheiros acima de 10 MB", async () => {
  const path = `${ids.orvel}/${ids.procRui}/uploads/${ruiRequest}/e2e-grande.pdf`;
  const big = new Blob([new Uint8Array(10 * 1024 * 1024 + 1024)], { type: "application/pdf" });
  const res = await rui.storage.from("documents").upload(path, big, { contentType: "application/pdf" });
  if (!res.error) cleanup.objects.push(path);
  assert(res.error, "o upload foi aceite");
});
await check("sem leitura direta: não descarrega, não lista, não cria URL assinado", async () => {
  const dl = await rui.storage.from("documents").download(ruiUploadPath);
  assert(dl.error, "download direto foi aceite");
  const signed = await rui.storage.from("documents").createSignedUrl(ruiUploadPath, 60);
  assert(signed.error, "URL assinado foi criado");
  const list = await rui.storage.from("documents").list(`${ids.orvel}/${ids.procRui}/uploads/${ruiRequest}`);
  assert(list.error || list.data.length === 0, "a listagem mostra ficheiros");
});
await check("regista o upload (register_upload) e o pedido passa a enviado", async () => {
  const docId = noError(
    await rui.rpc("register_upload", { p_request_id: ruiRequest, p_storage_path: ruiUploadPath, p_file_name: "passaporte.pdf" }),
    "register_upload",
  );
  cleanup.documents.push(docId);
  cleanup.requestsToReset.push(ruiRequest);
  const req = noError(await rui.from("document_requests").select("status").eq("id", ruiRequest).single(), "pedido");
  assert(req.status === "submitted", `estado ${req.status}`);
});

// ------------------------------------------------------------------------------------------------
console.log("\n— Equipa com password e MFA");
const team = client();
let aal1Token = null;
await check("login da equipa com password (aal1)", async () => {
  const data = noError(await team.auth.signInWithPassword({ email: "equipa@exemplo.test", password: PASSWORD }), "signInWithPassword");
  aal1Token = data.session.access_token;
  const aal = noError(await team.auth.mfa.getAuthenticatorAssuranceLevel(), "aal");
  assert(aal.currentLevel === "aal1", `nível ${aal.currentLevel}`);
});
await check("password errada recusada", async () => {
  const res = await client().auth.signInWithPassword({ email: "equipa@exemplo.test", password: "Errada-Errada-2026" });
  assert(res.error, "login aceite");
});
await check("sem MFA, a equipa não vê nada", async () => {
  for (const table of ["processes", "clients", "process_internal", "activity_log"]) {
    const res = await team.from(table).select("id");
    assert(!res.error && res.data.length === 0, `${table}: ${res.error?.message ?? `${res.data.length} linhas`}`);
  }
  const ctx = noError(await team.rpc("get_session_context", { p_org: ids.orvel }), "get_session_context");
  assert(ctx.role === "admin" && ctx.mfa_required === true, JSON.stringify(ctx));
});
await check("sem MFA, a equipa não carrega ficheiros", async () => {
  const path = `${ids.orvel}/${ids.procMarta}/issued/e2e-sem-mfa.pdf`;
  const res = await team.storage.from("documents").upload(path, pdf("sem mfa"), { contentType: "application/pdf" });
  if (!res.error) cleanup.objects.push(path);
  assert(res.error, "o upload foi aceite");
});
await check("sem MFA, o convite é recusado (mfa_required)", async () => {
  const res = await callFunction("invite-client", { token: aal1Token, body: { client_id: ids.clientRui } });
  assert(res.status === 403 && res.json?.error === "mfa_required", `HTTP ${res.status} ${JSON.stringify(res.json)}`);
});
await check("configura o MFA (TOTP) e passa a aal2", async () => {
  // Fatores de execuções anteriores: o segredo já não se conhece, por isso remove-os.
  const existing = noError(await admin.auth.admin.mfa.listFactors({ userId: ids.userTeam }), "listFactors").factors ?? [];
  for (const f of existing) noError(await admin.auth.admin.mfa.deleteFactor({ userId: ids.userTeam, id: f.id }), "deleteFactor");
  const enrolled = noError(await team.auth.mfa.enroll({ factorType: "totp", friendlyName: "teste e2e" }), "enroll");
  cleanup.factors.push(enrolled.id);
  assert(enrolled.totp?.secret && enrolled.totp?.qr_code, "sem segredo/QR");
  noError(await team.auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: totp(enrolled.totp.secret) }), "verify");
  const aal = noError(await team.auth.mfa.getAuthenticatorAssuranceLevel(), "aal");
  assert(aal.currentLevel === "aal2", `nível ${aal.currentLevel}`);
});
await check("com MFA, vê os processos e clientes só da sua organização", async () => {
  const procs = noError(await team.from("processes").select("id, organization_id"), "processes");
  assert(procs.length >= 3 && procs.every((p) => p.organization_id === ids.orvel), `${procs.length} processos`);
  const clients = noError(await team.from("clients").select("id, organization_id"), "clients");
  assert(clients.length >= 3 && !clients.some((c) => c.id === ids.clientCarla), "vê clientes de outra organização");
  const internal = noError(await team.from("process_internal").select("process_id"), "process_internal");
  assert(internal.length >= 1, "não vê dados internos");
});
await check("com MFA, carrega documento emitido na sua organização", async () => {
  const path = `${ids.orvel}/${ids.procMarta}/issued/e2e-emitido.pdf`;
  noError(await team.storage.from("documents").upload(path, pdf("emitido"), { contentType: "application/pdf" }), "upload");
  cleanup.objects.push(path);
});
await check("com MFA, não carrega na pasta de outra organização", async () => {
  const path = `${ids.exemplo}/${seedId("seed:proc-carla")}/issued/e2e-intruso.pdf`;
  const res = await team.storage.from("documents").upload(path, pdf("intruso"), { contentType: "application/pdf" });
  if (!res.error) cleanup.objects.push(path);
  assert(res.error, "o upload foi aceite");
});

// ------------------------------------------------------------------------------------------------
console.log("\n— Convite de cliente");
const inviteEmail = `convite.e2e.${Date.now()}@exemplo.test`;
const newClient = await check("equipa cria um cliente fictício", async () =>
  noError(
    await team.from("clients").insert({
      organization_id: ids.orvel,
      full_name: "Cliente Convite (teste)",
      email: inviteEmail,
      country: "Portugal",
    }).select("id").single(),
    "insert clients",
  ));
await check("convite sem sessão é recusado", async () => {
  const res = await callFunction("invite-client", { body: { client_id: newClient?.id ?? ids.clientRui } });
  assert(res.status === 401, `HTTP ${res.status}`);
});
const inviteSince = Date.now();
await check("convite enviado pela equipa com MFA", async () => {
  assert(newClient, "sem cliente");
  const token = (await team.auth.getSession()).data.session.access_token;
  const res = await callFunction("invite-client", { token, body: { client_id: newClient.id } });
  assert(res.status === 200 && res.json?.ok === true && res.json?.resent === false, `HTTP ${res.status} ${JSON.stringify(res.json)}`);
  assert(res.headers.get("access-control-allow-origin") === SITE_URL, `CORS ${res.headers.get("access-control-allow-origin")}`);
});
await check("reenvio imediato recusado (invite_too_soon)", async () => {
  assert(newClient, "sem cliente");
  const token = (await team.auth.getSession()).data.session.access_token;
  const res = await callFunction("invite-client", { token, body: { client_id: newClient.id } });
  assert(res.status === 429 && res.json?.error === "invite_too_soon", `HTTP ${res.status} ${JSON.stringify(res.json)}`);
});
const inviteMessage = newClient
  ? await check("email de convite com link para o portal", () => waitForEmail(inviteEmail, inviteSince))
  : undefined;
await check("email de convite com a marca, sem nomes internos", () => {
  assert(inviteMessage, "sem email");
  assert(inviteMessage.includes("Equipa Orvel Partners"), "sem a assinatura");
  assert(inviteMessage.includes("Cliente Convite (teste)"), "sem o nome do cliente na saudação");
  assertNoInternalNames(inviteMessage, "email de convite");
});
await check("o link do convite inicia sessão e pede o consentimento", async () => {
  assert(inviteMessage, "sem email");
  const link = linkFrom(inviteMessage);
  assert(link.origin === SITE_URL, `origem ${link.origin}`);
  const invited = client();
  noError(await invited.auth.verifyOtp({ token_hash: link.searchParams.get("token_hash"), type: "magiclink" }), "verifyOtp");
  const ctx = noError(await invited.rpc("get_session_context", { p_org: ids.orvel }), "get_session_context");
  assert(ctx.role === "client" && ctx.consent_required === true, JSON.stringify(ctx));
  const procs = noError(await invited.from("processes").select("id"), "processes");
  assert(procs.length === 0, "vê processos sem consentimento");
});

// ------------------------------------------------------------------------------------------------
console.log("\n— Limpeza");
await check("remove ficheiros, documento e fator MFA de teste; repõe o estado do Rui", async () => {
  if (cleanup.objects.length) noError(await admin.storage.from("documents").remove(cleanup.objects), "remover ficheiros");
  for (const id of cleanup.documents) noError(await admin.from("documents").delete().eq("id", id), "apagar documento");
  for (const id of cleanup.requestsToReset) {
    noError(await admin.from("document_requests").update({ status: "pending" }).eq("id", id), "repor pedido");
  }
  noError(await admin.from("privacy_consents").delete().eq("user_id", ids.userRui), "repor consentimento");
  for (const id of cleanup.factors) noError(await admin.auth.admin.mfa.deleteFactor({ userId: ids.userTeam, id }), "remover fator");
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
if (failed.length) {
  console.log("Falharam:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.error}`);
  process.exit(1);
}
