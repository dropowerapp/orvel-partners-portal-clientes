import { describe, expect, it } from "vitest";
import { logoUrl, resolveOrgKey } from "./org";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("resolveOrgKey", () => {
  it("em produção usa sempre o hostname", () => {
    expect(resolveOrgKey({ hostname: "Portal.OrvelPartners.com", search: "?org=exemplo" }, false, memoryStorage()))
      .toBe("portal.orvelpartners.com");
  });

  it("em desenvolvimento aceita ?org=slug e guarda a escolha", () => {
    const storage = memoryStorage();
    expect(resolveOrgKey({ hostname: "localhost", search: "?org=exemplo" }, true, storage)).toBe("exemplo");
    expect(resolveOrgKey({ hostname: "localhost", search: "" }, true, storage)).toBe("exemplo");
  });

  it("ignora slugs inválidos", () => {
    expect(resolveOrgKey({ hostname: "localhost", search: "?org=../x" }, true, memoryStorage())).toBe("localhost");
  });
});

describe("logoUrl", () => {
  it("monta o URL público do bucket branding", () => {
    expect(logoUrl({ logo_path: "orvel/logo final.png" }, "https://x.supabase.co/"))
      .toBe("https://x.supabase.co/storage/v1/object/public/branding/orvel/logo%20final.png");
    expect(logoUrl({ logo_path: null }, "https://x.supabase.co")).toBeNull();
  });
});
