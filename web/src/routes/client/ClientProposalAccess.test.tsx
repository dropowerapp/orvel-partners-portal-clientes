import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ORG } from "../../test/fixtures";
import { useClientProcesses } from "../../lib/clientData";
import ClientLayout from "./ClientLayout";
import ClientProposal from "./ClientProposal";

const state = vi.hoisted(() => ({
  accepted: false, second: false, closed: false, expired: false, failList: false,
  rpc: vi.fn(), protectedRender: vi.fn(),
}));
vi.mock("../../lib/OrgProvider", () => ({ useOrg: () => ORG }));
vi.mock("../../lib/AuthProvider", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock("../../lib/supabase", () => ({
  SUPABASE_URL: "",
  supabase: {
    rpc: state.rpc,
    from: () => {
      let process = "first";
      const query = {
        select: () => query,
        eq: (_column: string, id: string) => { process = id; return query; },
        order: async () => ({ data: [{
          id: `proposal-${process}`, reference: `ORV-2026-${process}`, pdf_path: null,
          plans: [{ name: "Serviço acordado", price_aed: 1000, includes_bank_account: false }],
          chosen_plan: state.accepted && process === "first" ? "Serviço acordado" : null,
          status: state.accepted && process === "first" ? "accepted" : "sent",
          valid_until: state.expired ? "2000-01-01" : "2099-01-01",
          sent_at: "2026-11-18", accepted_at: null, accepted_text: null,
        }], error: null }),
      };
      return query;
    },
  },
}));

function ProtectedPage() {
  const { current } = useClientProcesses();
  state.protectedRender(current?.id);
  return <p>Acompanhamento de {current?.id}</p>;
}
function show(path = "/documentos") {
  const router = createMemoryRouter([{
    element: <ClientLayout />,
    children: [
      { path: "/", element: <ProtectedPage /> },
      { path: "/documentos", element: <ProtectedPage /> },
      { path: "/proposta", element: <ClientProposal /> },
      { path: "/contacto", element: <p>Contacto da equipa</p> },
    ],
  }], { initialEntries: [path] });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}

beforeEach(() => {
  sessionStorage.clear();
  Object.assign(state, { accepted: false, second: false, closed: false, expired: false, failList: false });
  state.protectedRender.mockReset();
  state.rpc.mockReset();
  state.rpc.mockImplementation(async (name: string) => {
    if (name === "get_client_processes") return {
      data: state.failList ? null : (state.second ? ["first", "second"] : ["first"]).map((id) => ({
        id, proposal_accepted: id === "first" && state.accepted, status: "proposal_sent", plan_name: null,
        completed_at: null, cancelled_at: state.closed ? "2026-11-18" : null, created_at: "2026-11-18",
        company_name_options: [], includes_bank_account: false, bank_account_id: null, bank_details_released_at: null,
      })), error: state.failList ? new Error("network") : null,
    };
    if (name === "get_acceptance_text") return { data: "Texto da proposta a aceitar.", error: null };
    if (name === "accept_proposal") { state.accepted = true; return { data: null, error: null }; }
    throw new Error(`RPC inesperada: ${name}`);
  });
});

describe("proposta antes do acompanhamento", () => {
  it("um endereço direto de documentos encaminha para a proposta sem montar a área protegida", async () => {
    const router = show();
    expect(await screen.findByRole("heading", { name: "Proposta" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/proposta");
    expect(state.protectedRender).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Documentos" })).not.toBeInTheDocument();
    expect(await screen.findByText("Texto da proposta a aceitar.")).toBeInTheDocument();
    expect(state.rpc).toHaveBeenCalledWith("get_client_processes", { p_org: ORG.id });
  });

  it("exige confirmação da proposta, regista-a e abre o acompanhamento sem exigir pagamento", async () => {
    const user = userEvent.setup();
    const router = show("/proposta");
    const accept = await screen.findByRole("button", { name: "Aceitar a proposta" });
    expect(accept).toBeDisabled();
    await screen.findByText("Texto da proposta a aceitar.");
    await user.click(screen.getByRole("checkbox", { name: "Li a proposta e aceito este texto" }));
    await user.click(accept);
    expect(await screen.findByText("Acompanhamento de first")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(state.rpc).toHaveBeenCalledWith("accept_proposal", {
      p_proposal_id: "proposal-first", p_plan_name: "Serviço acordado", p_user_agent: navigator.userAgent,
    });
    expect(screen.getAllByRole("link", { name: "Documentos" })).toHaveLength(2);
  });

  it("mudar de um processo aceite para outro por aceitar regressa à proposta", async () => {
    state.accepted = true;
    state.second = true;
    const user = userEvent.setup();
    const router = show("/");
    await screen.findByText("Acompanhamento de first");
    await user.selectOptions(screen.getByRole("combobox"), "second");
    await screen.findByRole("heading", { name: "Proposta" });
    expect(router.state.location.pathname).toBe("/proposta");
    expect(state.protectedRender).not.toHaveBeenCalledWith("second");
    expect(await screen.findByText("ORV-2026-second")).toBeInTheDocument();
  });

  it("falha a obter autorização não mostra dados nem encaminha como se estivesse aceite", async () => {
    state.failList = true;
    show("/");
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o seu processo");
    expect(state.protectedRender).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it.each(["expired", "closed"] as const)("proposta %s não permite aceitar", async (reason) => {
    state[reason] = true;
    show("/proposta");
    await screen.findByText(reason === "expired"
      ? "Esta proposta já não está válida. Fale connosco para receber uma proposta atualizada."
      : "Este processo está encerrado. Fale connosco se precisar de uma nova proposta.");
    expect(screen.queryByRole("button", { name: "Aceitar a proposta" })).not.toBeInTheDocument();
    expect(state.protectedRender).not.toHaveBeenCalled();
  });
});
