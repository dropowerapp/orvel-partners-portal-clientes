import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/fixtures";
import { RequestLinkForm } from "./RequestLinkForm";

const signInWithOtp = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a) } } }));

describe("RequestLinkForm", () => {
  beforeEach(() => signInWithOtp.mockReset());

  it("pede o link sem criar contas novas e mostra o ecrã de verificar email", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    renderAt("/entrar", <RequestLinkForm />);
    await userEvent.type(screen.getByLabelText("Email"), " Rui.Ficticio@Exemplo.test ");
    await userEvent.click(screen.getByRole("button", { name: "Enviar link de acesso" }));
    await screen.findByText("Verifique o seu email");
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "rui.ficticio@exemplo.test",
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/confirmar` },
    });
  });

  it("email sem conta: mostra o mesmo ecrã (não revela se existe)", async () => {
    signInWithOtp.mockResolvedValue({ error: { code: "otp_disabled", status: 422, message: "Signups not allowed for otp" } });
    renderAt("/entrar", <RequestLinkForm />);
    await userEvent.type(screen.getByLabelText("Email"), "desconhecido@exemplo.test");
    await userEvent.click(screen.getByRole("button", { name: "Enviar link de acesso" }));
    await screen.findByText("Verifique o seu email");
  });

  it("limite de envios: pede para aguardar", async () => {
    signInWithOtp.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429, message: "x" } });
    renderAt("/entrar", <RequestLinkForm />);
    await userEvent.type(screen.getByLabelText("Email"), "rui.ficticio@exemplo.test");
    await userEvent.click(screen.getByRole("button", { name: "Enviar link de acesso" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Aguarde um minuto");
  });

  it("valida o email antes de enviar", async () => {
    renderAt("/entrar", <RequestLinkForm />);
    await userEvent.type(screen.getByLabelText("Email"), "nao-e-email");
    await userEvent.click(screen.getByRole("button", { name: "Enviar link de acesso" }));
    await waitFor(() => expect(screen.getByText("Indique um email válido.")).toBeInTheDocument());
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});
