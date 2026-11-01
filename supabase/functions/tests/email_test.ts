// Testes do envio pela Brevo e dos textos.
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { type EmailMessage, sendEmail } from "../_shared/email.ts";
import { t } from "../_shared/i18n.ts";

const MESSAGE: EmailMessage = {
  to: { email: "rui.ficticio@exemplo.test", name: "Rui Fictício" },
  from: { email: "hello@orvelpartners.com", name: "Orvel Partners" },
  replyTo: { email: "hello@orvelpartners.com" },
  subject: "Assunto",
  html: "<p>Olá</p>",
  text: "Olá",
  tags: ["auth-invite"],
};

Deno.test("brevo: envia com a chave no cabeçalho e o remetente da organização", async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  const fakeFetch = ((url: string, init: RequestInit) => {
    captured = { url, init };
    return Promise.resolve(new Response("{}", { status: 201 }));
  }) as unknown as typeof fetch;
  await sendEmail(MESSAGE, { BREVO_API_KEY: "chave-ficticia" }, fakeFetch);
  assertEquals(captured!.url, "https://api.brevo.com/v3/smtp/email");
  assertEquals((captured!.init.headers as Record<string, string>)["api-key"], "chave-ficticia");
  const body = JSON.parse(captured!.init.body as string);
  assertEquals(body.sender, { email: "hello@orvelpartners.com", name: "Orvel Partners" });
  assertEquals(body.replyTo, { email: "hello@orvelpartners.com" });
  assertEquals(body.to, [{ email: "rui.ficticio@exemplo.test", name: "Rui Fictício" }]);
});

Deno.test("brevo: sem chave e fora do modo log, falha (nunca perde emails em silêncio)", async () => {
  await assertRejects(() => sendEmail(MESSAGE, {}), Error, "email_not_configured");
});

Deno.test("brevo: erro da API não expõe o conteúdo do email", async () => {
  const fakeFetch = (() => Promise.resolve(new Response("bad", { status: 400 }))) as unknown as typeof fetch;
  await assertRejects(() => sendEmail(MESSAGE, { BREVO_API_KEY: "x" }, fakeFetch), Error, "email_send_failed:400");
});

Deno.test("brevo: modo log não chama a API", async () => {
  let called = false;
  const fakeFetch = (() => {
    called = true;
    return Promise.resolve(new Response("{}"));
  }) as unknown as typeof fetch;
  const original = console.log;
  console.log = () => {};
  try {
    await sendEmail(MESSAGE, { EMAIL_MODE: "log" }, fakeFetch);
  } finally {
    console.log = original;
  }
  assertEquals(called, false);
});

Deno.test("i18n: substitui variáveis e recorre a pt-PT para idiomas sem tradução", () => {
  assertEquals(t("pt-PT", "invite.subject", { org: "Orvel Partners" }), "O seu acesso ao portal Orvel Partners");
  assertEquals(t("en", "invite.subject", { org: "Orvel Partners" }), "O seu acesso ao portal Orvel Partners");
});
