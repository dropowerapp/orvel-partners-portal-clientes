import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORG, renderAt } from "../../test/fixtures";
import Confirm from "./Confirm";

const verifyOtp = vi.fn();
vi.mock("../../lib/supabase", () => ({
  supabase: { auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a), signInWithOtp: vi.fn() } },
  SUPABASE_URL: "",
}));
vi.mock("../../lib/OrgProvider", () => ({ useOrg: () => ORG }));

describe("Confirm", () => {
  beforeEach(() => verifyOtp.mockReset());

  it("link mágico válido: confirma uma única vez e entra", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    renderAt("/auth/confirmar?token_hash=abc&type=magiclink", <Confirm />, ["/", "/equipa/nova-password"]);
    await screen.findByText("rota:/");
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "magiclink" });
  });

  it("recuperação de password segue para a nova password", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    renderAt("/auth/confirmar?token_hash=abc&type=recovery", <Confirm />, ["/", "/equipa/nova-password"]);
    await screen.findByText("rota:/equipa/nova-password");
  });

  it("link expirado: explica e permite pedir outro", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired", message: "Email link is invalid or has expired" } });
    renderAt("/auth/confirmar?token_hash=abc&type=magiclink", <Confirm />, ["/"]);
    expect(await screen.findByText("Este link já não é válido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar link de acesso" })).toBeInTheDocument();
  });

  it("link incompleto ou de tipo não suportado não chama o servidor", () => {
    renderAt("/auth/confirmar?type=signup&token_hash=abc", <Confirm />, ["/"]);
    expect(screen.getByText("Link incompleto")).toBeInTheDocument();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
