// Testes do hook de email do Supabase Auth, incluindo a verificação real da assinatura.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { Webhook } from "npm:standardwebhooks@1.1.1";
import type { EmailMessage, OrgBranding } from "../_shared/email.ts";
import { handleSendEmailHook, type HookDeps, type HookPayload } from "../auth-send-email/handler.ts";

const SECRET = btoa("segredo-ficticio-para-testes-32bytes!!");
const webhook = new Webhook(SECRET);

const ORG: OrgBranding = {
  id: "00000000-0000-0000-0000-0000000000aa",
  name: "Orvel Partners",
  slug: "orvel",
  hostname: "portal.orvelpartners.com",
  logo_path: "orvel/logo.png",
  theme: { colors: { primary: "#0b1628", action: "javascript:alert(1)" } },
  email_from_name: "Orvel Partners",
  email_from_address: "hello@orvelpartners.com",
  email_reply_to: "hello@orvelpartners.com",
  contact_email: "hello@orvelpartners.com",
  contact_whatsapp: null,
  default_locale: "pt-PT",
};

function payload(action = "magiclink", redirect = "https://portal.orvelpartners.com/auth/confirmar"): HookPayload {
  return {
    user: { id: "55555555-5555-4555-8555-555555555555", email: "marta.exemplo@exemplo.test" },
    email_data: { token: "123456", token_hash: "hash<ficticio>", redirect_to: redirect, email_action_type: action, site_url: "" },
  };
}

function signed(body: HookPayload, secret = webhook): Request {
  const raw = JSON.stringify(body);
  const id = "msg_ficticio";
  const timestamp = new Date();
  const signature = secret.sign(id, timestamp, raw);
  return new Request("https://exemplo.test/functions/v1/auth-send-email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": signature,
    },
    body: raw,
  });
}

function deps(context: Awaited<ReturnType<HookDeps["emailContext"]>>["data"] = {
  role: "client",
  locale: "pt-PT",
  full_name: "Marta Exemplo",
  organization: ORG,
}) {
  const sent: EmailMessage[] = [];
  const hosts: (string | null)[] = [];
  const d: HookDeps = {
    env: { SUPABASE_URL: "https://ficticio.supabase.co" },
    verify: (raw, headers) => webhook.verify(raw, headers) as HookPayload,
    emailContext: (_id, host) => {
      hosts.push(host);
      return Promise.resolve({ data: context, error: null });
    },
    sendEmail: (m) => {
      sent.push(m);
      return Promise.resolve();
    },
  };
  return { d, sent, hosts };
}

Deno.test("hook: link mágico sai com a marca da organização e link para /auth/confirmar", async () => {
  const { d, sent, hosts } = deps();
  const res = await handleSendEmailHook(signed(payload()), d);
  assertEquals(res.status, 200);
  assertEquals(hosts, ["portal.orvelpartners.com"]);
  assertEquals(sent.length, 1);
  const email = sent[0];
  assertEquals(email.subject, "O seu link de acesso ao portal Orvel Partners");
  assertEquals(email.from.email, "hello@orvelpartners.com");
  assertStringIncludes(email.text, "Olá Marta Exemplo,");
  assertStringIncludes(
    email.text,
    "https://portal.orvelpartners.com/auth/confirmar?token_hash=hash%3Cficticio%3E&type=magiclink",
  );
  assertStringIncludes(email.html, "https://ficticio.supabase.co/storage/v1/object/public/branding/orvel/logo.png");
  assertEquals(email.html.includes("javascript:"), false, "cor inválida no tema é ignorada");
  assertEquals(email.html.includes("<ficticio>"), false, "valores escapados no HTML");
});

Deno.test("hook: recuperação de password usa o modelo próprio", async () => {
  const { d, sent } = deps({ role: "admin", locale: "pt-PT", full_name: null, organization: ORG });
  const res = await handleSendEmailHook(signed(payload("recovery")), d);
  assertEquals(res.status, 200);
  assertEquals(sent[0].subject, "Redefinir a password do portal Orvel Partners");
  assertStringIncludes(sent[0].text, "Olá,");
  assertStringIncludes(sent[0].text, "type=recovery");
});

Deno.test("hook: assinatura inválida é recusada e nada é enviado", async () => {
  const { d, sent } = deps();
  const other = new Webhook(btoa("outro-segredo-qualquer-com-32-bytes!!"));
  const res = await handleSendEmailHook(signed(payload(), other), d);
  assertEquals(res.status, 401);
  assertEquals(sent.length, 0);

  const tampered = signed(payload());
  const body = (await tampered.text()).replace("marta.exemplo", "atacante");
  const res2 = await handleSendEmailHook(new Request(tampered.url, { method: "POST", headers: tampered.headers, body }), d);
  assertEquals(res2.status, 401);
  assertEquals(sent.length, 0);
});

Deno.test("hook: tipos de email não usados pelo portal são recusados", async () => {
  const { d, sent } = deps();
  const res = await handleSendEmailHook(signed(payload("email_change")), d);
  assertEquals(res.status, 400);
  assertEquals(sent.length, 0);
});

Deno.test("hook: utilizador sem organização não recebe email (resposta 200)", async () => {
  const { d, sent } = deps(null);
  const res = await handleSendEmailHook(signed(payload()), d);
  assertEquals(res.status, 200);
  assertEquals(sent.length, 0);
});

Deno.test("hook: sem redirect_to válido usa o endereço do portal da organização", async () => {
  const { d, sent } = deps();
  await handleSendEmailHook(signed(payload("magiclink", "nao-e-url")), d);
  assertStringIncludes(sent[0].text, "https://portal.orvelpartners.com/auth/confirmar?");
});

Deno.test("hook: falha no envio devolve erro ao Supabase Auth", async () => {
  const { d } = deps();
  d.sendEmail = () => Promise.reject(new Error("falhou"));
  const res = await handleSendEmailHook(signed(payload()), d);
  assertEquals(res.status, 502);
});
