import { afterEach, describe, expect, it, vi } from "vitest";
import { openDownload } from "./download";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
afterEach(() => vi.restoreAllMocks());
describe("downloads privados", () => {
  it("fecha a janela vazia quando a rede falha", async () => {
    const popup = { close: vi.fn(), opener: window, location: { href: "" } };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    mocks.invoke.mockRejectedValue(new Error("offline"));
    expect(await openDownload("document", "doc")).toBe("network");
    expect(popup.close).toHaveBeenCalledOnce();
  });
  it("abre o URL assinado sem manter acesso à janela de origem", async () => {
    const popup = { close: vi.fn(), opener: window, location: { href: "" } };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    mocks.invoke.mockResolvedValue({ data: { url: "https://example.test/signed-document" }, error: null });
    expect(await openDownload("document", "doc")).toBeNull();
    expect(popup.location.href).toBe("https://example.test/signed-document");
    expect(popup.opener).toBeNull();
  });
});
