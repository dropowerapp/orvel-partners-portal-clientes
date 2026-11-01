import { describe, expect, it } from "vitest";
import { decideAccess, noticeText, safeNext, type SessionContext } from "./access";

const base: SessionContext = {
  role: "client",
  client_id: "c1",
  mfa_required: false,
  consent_required: false,
  notice_missing: false,
  notice: null,
};

describe("decideAccess", () => {
  it("sem sessão → login", () => {
    expect(decideAccess("client", { hasSession: false, context: null, aal: null })).toEqual({ kind: "login" });
    expect(decideAccess("staff", { hasSession: false, context: null, aal: null })).toEqual({ kind: "login" });
  });

  it("sem papel nesta organização ou parceiro → sem acesso", () => {
    expect(decideAccess("client", { hasSession: true, context: { ...base, role: null }, aal: "aal1" }).kind).toBe("no_access");
    expect(decideAccess("staff", { hasSession: true, context: { ...base, role: "partner" }, aal: "aal2" }).kind).toBe("no_access");
  });

  it("cliente: consentimento e aviso em falta antes de entrar", () => {
    expect(decideAccess("client", { hasSession: true, context: { ...base, consent_required: true }, aal: "aal1" }).kind)
      .toBe("consent");
    expect(decideAccess("client", { hasSession: true, context: { ...base, notice_missing: true }, aal: "aal1" }).kind)
      .toBe("notice_missing");
    expect(decideAccess("client", { hasSession: true, context: base, aal: "aal1" }).kind).toBe("ok");
  });

  it("equipa: sem MFA vai para o código; com MFA entra", () => {
    const admin = { ...base, role: "admin" as const, client_id: null, mfa_required: true };
    expect(decideAccess("staff", { hasSession: true, context: admin, aal: "aal1" }).kind).toBe("mfa");
    expect(decideAccess("staff", { hasSession: true, context: admin, aal: "aal2" }).kind).toBe("ok");
  });

  it("cada papel é enviado para a sua área", () => {
    const admin = { ...base, role: "admin" as const };
    expect(decideAccess("client", { hasSession: true, context: admin, aal: "aal2" })).toEqual({ kind: "redirect", to: "/equipa" });
    expect(decideAccess("staff", { hasSession: true, context: base, aal: "aal1" })).toEqual({ kind: "redirect", to: "/" });
  });
});

describe("noticeText", () => {
  it("insere o prazo de conservação e usa pt-PT por omissão", () => {
    const notice = { id: "n", version: 2, retention_days: 30, body: { "pt-PT": "Apagados {retention_days} dias depois." } };
    expect(noticeText(notice, "en")).toBe("Apagados 30 dias depois.");
  });
});

describe("safeNext", () => {
  it("só aceita caminhos internos", () => {
    expect(safeNext("/equipa", "/")).toBe("/equipa");
    expect(safeNext("https://malicioso.test", "/")).toBe("/");
    expect(safeNext("//malicioso.test", "/")).toBe("/");
    expect(safeNext("/\\malicioso.test", "/")).toBe("/");
    expect(safeNext(null, "/x")).toBe("/x");
  });
});
