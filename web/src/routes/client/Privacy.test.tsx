import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionContext } from "../../lib/access";
import { CLIENT_CONTEXT, ORG, renderAt } from "../../test/fixtures";
import Privacy from "./Privacy";

const rpc = vi.fn();
const refresh = vi.fn();
let context: SessionContext;

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) }, SUPABASE_URL: "" }));
vi.mock("../../lib/OrgProvider", () => ({ useOrg: () => ORG }));
vi.mock("../../lib/AuthProvider", () => ({
  useAuth: () => ({ ready: true, session: { user: { id: "u" } }, context, contextLoading: false, refresh, signOut: vi.fn() }),
}));

describe("Privacy", () => {
  beforeEach(() => {
    rpc.mockReset();
    refresh.mockReset();
    context = {
      ...CLIENT_CONTEXT,
      consent_required: true,
      notice: { id: "n2", version: 2, retention_days: 30, body: { "pt-PT": "Os ficheiros são apagados {retention_days} dias depois." } },
    };
  });

  it("mostra o aviso com o prazo de conservação e exige a confirmação", async () => {
    renderAt("/privacidade", <Privacy />, ["/"]);
    expect(screen.getByText("Os ficheiros são apagados 30 dias depois.")).toBeInTheDocument();
    expect(screen.getByText("Versão 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aceitar e continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("confirme que leu e aceita");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("aceita o aviso em vigor e entra", async () => {
    rpc.mockResolvedValue({ error: null });
    renderAt("/privacidade", <Privacy />, ["/"]);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Aceitar e continuar" }));
    await screen.findByText("rota:/");
    expect(rpc).toHaveBeenCalledWith("accept_privacy_notice", { p_notice_id: "n2", p_user_agent: navigator.userAgent });
    expect(refresh).toHaveBeenCalled();
  });

  it("sem aviso publicado: área ainda não disponível", () => {
    context = { ...CLIENT_CONTEXT, notice_missing: true };
    renderAt("/privacidade", <Privacy />, ["/"]);
    expect(screen.getByText("A sua área de cliente ainda não está disponível")).toBeInTheDocument();
  });
});
