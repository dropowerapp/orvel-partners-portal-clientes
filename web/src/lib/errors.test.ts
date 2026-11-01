import { describe, expect, it } from "vitest";
import { errorCode, functionErrorCode } from "./errors";

describe("errorCode", () => {
  it("reconhece códigos do Supabase Auth e da base de dados", () => {
    expect(errorCode({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("invalid_credentials");
    expect(errorCode({ code: "P0001", message: "process_closed" })).toBe("process_closed");
    expect(errorCode({ code: "P0002", message: "not_found" })).toBe("not_found");
  });

  it("erros desconhecidos ficam genéricos (sem detalhes internos)", () => {
    expect(errorCode({ code: "XX000", message: "relation x does not exist" })).toBe("generic");
    expect(errorCode(null)).toBe("generic");
  });

  it("erros de rede", () => {
    expect(errorCode({ name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe("network");
  });
});

describe("functionErrorCode", () => {
  it("lê o código no corpo da resposta da Edge Function", async () => {
    const context = new Response(JSON.stringify({ error: "invite_too_soon" }), { status: 429 });
    expect(await functionErrorCode({ name: "FunctionsHttpError", context })).toBe("invite_too_soon");
  });

  it("código desconhecido → genérico", async () => {
    const context = new Response(JSON.stringify({ error: "outro" }), { status: 500 });
    expect(await functionErrorCode({ name: "FunctionsHttpError", context })).toBe("generic");
  });
});
