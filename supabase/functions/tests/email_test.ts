// Testes do envio pela Resend e dos textos.
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { type EmailMessage, formatAddress, inLogDomains, sendEmail } from "../_shared/email.ts";
import { t } from "../_shared/i18n.ts";

const MESSAGE: EmailMessage = {
  to: { email: "rui.ficticio@exemplo.test", name: "Rui Fictício" },
  from: { email: "hello@orvelpartners.com", name: "Orvel Partners" },
  replyTo: { email: "hello@orvelpartners.com" },
  subject: "Assunto",
  html: "<p>Olá</p>",
  text: "Olá https://portal.exemplo.test/auth/confirmar?token_hash=segredo",
  tags: { type: "auth-invite", org: "orvel" },
};

function capture(status = 200, body = '{"id":"x"}') {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(body, { status }));
  }) as unknown as typeof fetch;
  return { calls, fakeFetch };
}

async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = original;
  }
}

Deno.test("resend: envia com a chave no cabeçalho e o remetente da organização", async () => {
  const { calls, fakeFetch } = capture();
  await sendEmail(MESSAGE, { RESEND_API_KEY: "chave-ficticia" }, fakeFetch);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://api.resend.com/emails");
  assertEquals((calls[0].init.headers as Record<string, string>).authorization, "Bearer chave-ficticia");
  const body = JSON.parse(calls[0].init.body as string);
  assertEquals(body.from, "Orvel Partners <hello@orvelpartners.com>");
  assertEquals(body.reply_to, "hello@orvelpartners.com");
  assertEquals(body.to, ["Rui Fictício <rui.ficticio@exemplo.test>"]);
  assertEquals(body.subject, "Assunto");
  assertEquals(body.html, "<p>Olá</p>");
  assertEquals(body.tags, [{ name: "type", value: "auth-invite" }, { name: "org", value: "orvel" }]);
});

Deno.test("resend: sem chave e fora do log, falha (nunca perde emails em silêncio)", async () => {
  await assertRejects(() => sendEmail(MESSAGE, {}), Error, "email_not_configured");
});

Deno.test("resend: erro da API não expõe o conteúdo do email", async () => {
  const { fakeFetch } = capture(403, '{"statusCode":403,"name":"validation_error","message":"domínio por confirmar"}');
  const error = await assertRejects(() => sendEmail(MESSAGE, { RESEND_API_KEY: "x" }, fakeFetch), Error);
  assertEquals(error.message, "email_send_failed:403:validation_error");
  const { fakeFetch: plain } = capture(500, "bad");
  await assertRejects(() => sendEmail(MESSAGE, { RESEND_API_KEY: "x" }, plain), Error, "email_send_failed:500");
});

Deno.test("resend: modo log não chama a API", async () => {
  const { calls, fakeFetch } = capture();
  await quietly(() => sendEmail(MESSAGE, { EMAIL_MODE: "log", RESEND_API_KEY: "x" }, fakeFetch));
  assertEquals(calls.length, 0);
});

Deno.test("resend: domínios em EMAIL_LOG_DOMAINS ficam no log; os outros saem pela API", async () => {
  const { calls, fakeFetch } = capture();
  const env = { RESEND_API_KEY: "x", EMAIL_LOG_DOMAINS: "exemplo.test, outro.test" };
  await quietly(() => sendEmail(MESSAGE, env, fakeFetch));
  assertEquals(calls.length, 0);
  await sendEmail({ ...MESSAGE, to: { email: "hello@orvelpartners.com" } }, env, fakeFetch);
  assertEquals(calls.length, 1);
});

Deno.test("resend: domínios do log por domínio exato ou subdomínio", () => {
  assertEquals(inLogDomains("a@exemplo.test", "exemplo.test"), true);
  assertEquals(inLogDomains("a@Sub.Exemplo.Test", "@exemplo.test"), true);
  assertEquals(inLogDomains("a@naoexemplo.test", "exemplo.test"), false);
  assertEquals(inLogDomains("a@exemplo.test", ""), false);
  assertEquals(inLogDomains("a@exemplo.test", undefined), false);
});

Deno.test("resend: formato dos endereços", () => {
  assertEquals(formatAddress({ email: "a@b.pt" }), "a@b.pt");
  assertEquals(formatAddress({ email: "a@b.pt", name: "Orvel Partners" }), "Orvel Partners <a@b.pt>");
  assertEquals(formatAddress({ email: "a@b.pt", name: "Silva, Ana" }), '"Silva, Ana" <a@b.pt>');
  assertEquals(formatAddress({ email: "a@b.pt", name: 'Má "<x>"\r\n' }), "Má x <a@b.pt>");
});

Deno.test("i18n: substitui variáveis e recorre a pt-PT para idiomas sem tradução", () => {
  assertEquals(t("pt-PT", "invite.subject", { org: "Orvel Partners" }), "O seu acesso ao portal Orvel Partners");
  assertEquals(t("en", "invite.subject", { org: "Orvel Partners" }), "O seu acesso ao portal Orvel Partners");
});
