import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORG, renderAt } from "../../test/fixtures";
import Mfa from "./Mfa";

const mfa = vi.hoisted(() => ({
  listFactors: vi.fn(),
  unenroll: vi.fn(),
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
}));
const refresh = vi.fn();
let aal: "aal1" | "aal2" = "aal1";

vi.mock("../../lib/supabase", () => ({ supabase: { auth: { mfa } }, SUPABASE_URL: "" }));
vi.mock("../../lib/OrgProvider", () => ({ useOrg: () => ORG }));
vi.mock("../../lib/AuthProvider", () => ({
  useAuth: () => ({ ready: true, session: { user: { id: "staff" } }, aal, refresh }),
}));

describe("Mfa", () => {
  beforeEach(() => {
    Object.values(mfa).forEach((f) => f.mockReset());
    refresh.mockReset();
    aal = "aal1";
  });

  it("primeira vez: remove configurações abandonadas, mostra o QR e confirma o código", async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [], all: [{ id: "velho", factor_type: "totp", status: "unverified" }] },
      error: null,
    });
    mfa.unenroll.mockResolvedValue({ error: null });
    mfa.enroll.mockResolvedValue({
      data: { id: "novo", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "SEGREDOFICTICIO", uri: "otpauth://x" } },
      error: null,
    });
    mfa.challengeAndVerify.mockResolvedValue({ error: null });

    renderAt("/equipa/mfa?next=%2Fequipa", <Mfa />, ["/equipa"]);
    expect(await screen.findByAltText("Código QR para a aplicação de autenticação")).toBeInTheDocument();
    expect(screen.getByText("SEGREDOFICTICIO")).toBeInTheDocument();
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "velho" });

    await userEvent.type(screen.getByLabelText("Código de 6 dígitos"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByText("rota:/equipa");
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "novo", code: "123456" });
    expect(refresh).toHaveBeenCalled();
  });

  it("já configurado: pede só o código; código errado mostra erro", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f1", status: "verified" }], all: [] }, error: null });
    mfa.challengeAndVerify.mockResolvedValue({ error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered" } });

    renderAt("/equipa/mfa", <Mfa />, ["/equipa"]);
    expect(await screen.findByText("Código de verificação")).toBeInTheDocument();
    expect(mfa.enroll).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Código de 6 dígitos"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código incorreto ou expirado");
  });

  it("código com formato errado não é enviado", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f1", status: "verified" }], all: [] }, error: null });
    renderAt("/equipa/mfa", <Mfa />, ["/equipa"]);
    await userEvent.type(await screen.findByLabelText("Código de 6 dígitos"), "12ab");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(screen.getByText("O código tem 6 dígitos.")).toBeInTheDocument());
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("destino externo em ?next é ignorado", async () => {
    aal = "aal2";
    renderAt("/equipa/mfa?next=https%3A%2F%2Fmalicioso.test", <Mfa />, ["/equipa"]);
    expect(await screen.findByText("rota:/equipa")).toBeInTheDocument();
  });
});
