// Testes do download com URL assinado (sign-download).
import { assertEquals } from "jsr:@std/assert@1";
import { type DownloadTarget, handleSignDownload, type SignDeps, SIGNED_URL_SECONDS } from "../sign-download/handler.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const TARGET: DownloadTarget = {
  organization_id: "org",
  process_id: "proc",
  path: "org/proc/proposals/p/proposta.pdf",
  file_name: "ORV-2026-001.pdf",
  sensitive: false,
};

function deps(over: Partial<SignDeps> = {}) {
  const calls = { sign: [] as [string, number][], logs: 0, find: [] as string[] };
  const d: SignDeps = {
    env: { ALLOWED_ORIGINS: "https://portal.exemplo.test" },
    getActor: (auth) => Promise.resolve(auth === "Bearer bom" ? { id: "user-1" } : null),
    findTarget: (_auth, kind) => {
      calls.find.push(kind);
      return Promise.resolve(TARGET);
    },
    sign: (path, seconds) => {
      calls.sign.push([path, seconds]);
      return Promise.resolve("https://storage.exemplo.test/assinado");
    },
    logDownload: () => {
      calls.logs++;
      return Promise.resolve();
    },
    ...over,
  };
  return { d, calls };
}

function request(body: unknown, auth = "Bearer bom") {
  return new Request("https://exemplo.test/functions/v1/sign-download", {
    method: "POST",
    headers: { authorization: auth, origin: "https://portal.exemplo.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("download: devolve um URL assinado de 60 s para um registo visível", async () => {
  const { d, calls } = deps();
  const res = await handleSignDownload(request({ kind: "proposal", id: ID }), d);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { url: "https://storage.exemplo.test/assinado", file_name: "ORV-2026-001.pdf", expires_in: 60 });
  assertEquals(calls.sign, [[TARGET.path!, SIGNED_URL_SECONDS]]);
  assertEquals(calls.logs, 0);
  assertEquals(res.headers.get("access-control-allow-origin"), "https://portal.exemplo.test");
});

Deno.test("download: sem sessão → 401, sem assinar nada", async () => {
  const { d, calls } = deps();
  const res = await handleSignDownload(request({ kind: "proposal", id: ID }, "Bearer mau"), d);
  assertEquals(res.status, 401);
  assertEquals(calls.sign.length, 0);
});

Deno.test("download: pedido inválido → 400", async () => {
  const { d } = deps();
  assertEquals((await handleSignDownload(request({ kind: "outro", id: ID }), d)).status, 400);
  assertEquals((await handleSignDownload(request({ kind: "document", id: "x" }), d)).status, 400);
});

Deno.test("download: registo que a RLS não mostra (ou sem ficheiro) → 404", async () => {
  const { d, calls } = deps({ findTarget: () => Promise.resolve(null) });
  assertEquals((await handleSignDownload(request({ kind: "document", id: ID }), d)).status, 404);
  assertEquals(calls.sign.length, 0);
  const { d: noPath } = deps({ findTarget: () => Promise.resolve({ ...TARGET, path: null }) });
  assertEquals((await handleSignDownload(request({ kind: "proposal", id: ID }), noPath)).status, 404);
});

Deno.test("download: documento sensível fica registado; se o registo falhar, não há URL", async () => {
  const sensitive = { ...TARGET, sensitive: true };
  const { d, calls } = deps({ findTarget: () => Promise.resolve(sensitive) });
  assertEquals((await handleSignDownload(request({ kind: "document", id: ID }), d)).status, 200);
  assertEquals(calls.logs, 1);

  const original = console.error;
  console.error = () => {};
  try {
    const { d: failing } = deps({
      findTarget: () => Promise.resolve(sensitive),
      logDownload: () => Promise.reject(new Error("x")),
    });
    const res = await handleSignDownload(request({ kind: "document", id: ID }), failing);
    assertEquals(res.status, 500);
    assertEquals((await res.json()).url, undefined);
  } finally {
    console.error = original;
  }
});

Deno.test("download: registo visível não permite assinar um caminho de outro processo", async () => {
  for (const path of ["outra/proc/documento.pdf", "org/outro/documento.pdf", "org/proc/../documento.pdf", "org/proc//documento.pdf"]) {
    const { d, calls } = deps({ findTarget: () => Promise.resolve({ ...TARGET, path }) });
    assertEquals((await handleSignDownload(request({ kind: "document", id: ID }), d)).status, 404);
    assertEquals(calls.sign, []);
  }
});

Deno.test("download: OPTIONS responde ao preflight", async () => {
  const { d } = deps();
  const res = await handleSignDownload(
    new Request("https://exemplo.test/x", { method: "OPTIONS", headers: { origin: "https://portal.exemplo.test" } }),
    d,
  );
  assertEquals(res.status, 200);
});
