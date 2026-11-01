// Testes da função invite-client com dependências simuladas (dados fictícios).
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import type { EmailMessage, OrgBranding } from "../_shared/email.ts";
import { handleInvite, type InviteDeps } from "../invite-client/handler.ts";

const ORG: OrgBranding = {
  id: "00000000-0000-0000-0000-0000000000aa",
  name: "Orvel Partners",
  slug: "orvel",
  hostname: "portal.orvelpartners.com",
  logo_path: null,
  theme: { colors: { primary: "#0b1628", action: "#2a57c4" } },
  email_from_name: "Orvel Partners",
  email_from_address: "hello@orvelpartners.com",
  email_reply_to: "hello@orvelpartners.com",
  contact_email: "hello@orvelpartners.com",
  contact_whatsapp: null,
  default_locale: "pt-PT",
};
const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";

interface Calls {
  rpc: { fn: string; args: Record<string, unknown> }[];
  created: string[];
  sent: EmailMessage[];
}

function deps(
  overrides: Partial<InviteDeps> & { isStaff?: boolean; existingUser?: string | null; clientUser?: string | null } = {},
) {
  const calls: Calls = { rpc: [], created: [], sent: [] };
  const d: InviteDeps = {
    env: { ALLOWED_ORIGINS: "https://portal.orvelpartners.com" },
    getActor: () => Promise.resolve({ id: ACTOR_ID }),
    userRpc: <T>(_auth: string, fn: string) => {
      calls.rpc.push({ fn, args: {} });
      return Promise.resolve({ data: (overrides.isStaff ?? true) as T, error: null });
    },
    adminRpc: <T>(fn: string, args: Record<string, unknown>) => {
      calls.rpc.push({ fn, args });
      if (fn === "admin_prepare_invite") {
        return Promise.resolve({
          data: {
            client: {
              id: CLIENT_ID,
              full_name: "Rui Fictício",
              email: "rui.ficticio@exemplo.test",
              locale: "pt-PT",
              user_id: overrides.clientUser ?? null,
              invited_at: null,
            },
            organization: ORG,
          } as T,
          error: null,
        });
      }
      if (fn === "admin_user_id_by_email") {
        return Promise.resolve({ data: (overrides.existingUser ?? null) as T, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    createAuthUser: (email) => {
      calls.created.push(email);
      return Promise.resolve({ id: "33333333-3333-4333-8333-333333333333", error: null });
    },
    generateMagicLinkHash: () => Promise.resolve({ hashedToken: "hash-ficticio", error: null }),
    sendEmail: (message) => {
      calls.sent.push(message);
      return Promise.resolve();
    },
    ...overrides,
  };
  return { d, calls };
}

function request(body: unknown, headers: Record<string, string> = { authorization: "Bearer token-ficticio" }) {
  return new Request("https://exemplo.test/functions/v1/invite-client", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://portal.orvelpartners.com", ...headers },
    body: JSON.stringify(body),
  });
}

Deno.test("convida: cria conta, liga ao cliente e envia o email com a marca", async () => {
  const { d, calls } = deps();
  const res = await handleInvite(request({ client_id: CLIENT_ID }), d);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true, resent: false });
  assertEquals(calls.created, ["rui.ficticio@exemplo.test"]);
  const register = calls.rpc.find((c) => c.fn === "admin_register_invite");
  assertEquals(register?.args, {
    p_client_id: CLIENT_ID,
    p_user_id: "33333333-3333-4333-8333-333333333333",
    p_actor: ACTOR_ID,
  });
  assertEquals(calls.sent.length, 1);
  const email = calls.sent[0];
  assertEquals(email.from, { email: "hello@orvelpartners.com", name: "Orvel Partners" });
  assertEquals(email.replyTo, { email: "hello@orvelpartners.com" });
  assertEquals(email.subject, "O seu acesso ao portal Orvel Partners");
  assertStringIncludes(email.html, "https://portal.orvelpartners.com/auth/confirmar?token_hash=hash-ficticio&amp;type=magiclink");
  assertStringIncludes(email.text, "Olá Rui Fictício,");
  assertStringIncludes(email.text, "Equipa Orvel Partners");
  assertEquals(res.headers.get("access-control-allow-origin"), "https://portal.orvelpartners.com");
});

Deno.test("convida: reaproveita conta existente com o mesmo email", async () => {
  const { d, calls } = deps({ existingUser: "44444444-4444-4444-8444-444444444444" });
  const res = await handleInvite(request({ client_id: CLIENT_ID }), d);
  assertEquals(res.status, 200);
  assertEquals(calls.created, []);
  assertEquals(calls.rpc.find((c) => c.fn === "admin_register_invite")?.args.p_user_id, "44444444-4444-4444-8444-444444444444");
});

Deno.test("convida: equipa sem MFA é recusada e nada é criado nem enviado", async () => {
  const { d, calls } = deps({ isStaff: false });
  const res = await handleInvite(request({ client_id: CLIENT_ID }), d);
  assertEquals(res.status, 403);
  assertEquals(await res.json(), { error: "mfa_required" });
  assertEquals(calls.created, []);
  assertEquals(calls.sent, []);
  assert(!calls.rpc.some((c) => c.fn === "admin_register_invite"));
});

Deno.test("convida: sem token ou token inválido → 401", async () => {
  const { d } = deps();
  assertEquals((await handleInvite(request({ client_id: CLIENT_ID }, {}), d)).status, 401);
  const invalid = deps({ getActor: () => Promise.resolve(null) });
  assertEquals((await handleInvite(request({ client_id: CLIENT_ID }), invalid.d)).status, 401);
});

Deno.test("convida: pedido inválido → 400", async () => {
  const { d } = deps();
  const res = await handleInvite(request({ client_id: "nao-e-uuid" }), d);
  assertEquals(res.status, 400);
  assertEquals(await res.json(), { error: "invalid_request" });
});

Deno.test("convida: erros da base de dados passam com código estável", async () => {
  const { d } = deps({
    adminRpc: () => Promise.resolve({ data: null, error: { message: "invite_too_soon" } }),
  });
  const res = await handleInvite(request({ client_id: CLIENT_ID }), d);
  assertEquals(res.status, 429);
  assertEquals(await res.json(), { error: "invite_too_soon" });

  const other = deps({
    adminRpc: () => Promise.resolve({ data: null, error: { message: "erro interno com detalhes" } }),
  });
  const res2 = await handleInvite(request({ client_id: CLIENT_ID }), other.d);
  assertEquals(res2.status, 500);
  assertEquals(await res2.json(), { error: "server_error" }, "detalhes internos não chegam ao portal");
});

Deno.test("convida: falha no envio devolve email_send_failed", async () => {
  const { d } = deps({ sendEmail: () => Promise.reject(new Error("brevo em baixo")) });
  const res = await handleInvite(request({ client_id: CLIENT_ID }), d);
  assertEquals(res.status, 502);
  assertEquals(await res.json(), { error: "email_send_failed" });
});

Deno.test("convida: em desenvolvimento usa PUBLIC_SITE_URL no link", async () => {
  const { d, calls } = deps();
  d.env.PUBLIC_SITE_URL = "http://localhost:5173/";
  await handleInvite(request({ client_id: CLIENT_ID }), d);
  assertStringIncludes(calls.sent[0].text, "http://localhost:5173/auth/confirmar?token_hash=hash-ficticio&type=magiclink");
});

Deno.test("convida: OPTIONS responde ao preflight", async () => {
  const { d } = deps();
  const res = await handleInvite(
    new Request("https://exemplo.test", { method: "OPTIONS", headers: { origin: "https://outro.test" } }),
    d,
  );
  assertEquals(res.status, 200);
  assertEquals(
    res.headers.get("access-control-allow-origin"),
    "https://portal.orvelpartners.com",
    "origem não autorizada não é refletida",
  );
});
