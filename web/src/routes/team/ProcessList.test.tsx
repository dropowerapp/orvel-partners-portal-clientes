import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProcessListRow } from "../../lib/team";
import { ORG, renderAt } from "../../test/fixtures";
import ProcessList from "./ProcessList";

const ROWS: ProcessListRow[] = [
  {
    id: "p-rui",
    status: "awaiting_payment",
    plan_name: "Essencial",
    created_at: "2026-10-01T10:00:00Z",
    client: { id: "c1", full_name: "Rui Fictício", email: "rui.ficticio@exemplo.test" },
    payments: [{ status: "pending", due_on: "2020-01-01" }],
    document_requests: [{ status: "submitted" }],
    deadlines: [],
  },
  {
    id: "p-marta",
    status: "new",
    plan_name: null,
    created_at: "2026-11-10T10:00:00Z",
    client: { id: "c2", full_name: "Marta Exemplo", email: "marta.exemplo@exemplo.test" },
    payments: [],
    document_requests: [],
    deadlines: [],
  },
  {
    id: "p-joao",
    status: "completed",
    plan_name: "Completo",
    created_at: "2026-09-10T10:00:00Z",
    client: { id: "c3", full_name: "João Teste", email: "joao.teste@exemplo.test" },
    payments: [],
    document_requests: [],
    deadlines: [],
  },
];

// Supabase simulado: cada tabela devolve os dados fictícios acima.
function query(table: string) {
  const result =
    table === "processes"
      ? { data: ROWS, error: null }
      : { data: { timezone: "Asia/Dubai", proposal_ref_prefix: "ORV", default_locale: "pt-PT" }, error: null };
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    single: () => builder,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("../../lib/supabase", () => ({ supabase: { from: (table: string) => query(table) }, SUPABASE_URL: "" }));
vi.mock("../../lib/OrgProvider", () => ({ useOrg: () => ORG }));

describe("ProcessList", () => {
  it("mostra os processos em aberto, com alertas primeiro, e liga à ficha", async () => {
    renderAt("/equipa/processos", <ProcessList />);
    const rows = await screen.findAllByRole("row");
    // cabeçalho + 2 em aberto (o concluído fica de fora)
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByRole("link", { name: "Rui Fictício" })).toHaveAttribute("href", "/equipa/processos/p-rui");
    expect(within(rows[1]).getByText("Documentos por validar: 1")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Pagamentos em atraso: 1")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Por pagar")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Marta Exemplo")).toBeInTheDocument();
    expect(screen.queryByText("João Teste")).not.toBeInTheDocument();
  });

  it("filtra por estado e pesquisa sem acentos", async () => {
    renderAt("/equipa/processos", <ProcessList />);
    await screen.findByText("Rui Fictício");

    await userEvent.click(screen.getByRole("button", { name: /^Concluído/ }));
    expect(screen.getByText("João Teste")).toBeInTheDocument();
    expect(screen.queryByText("Rui Fictício")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Todos/ }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Pesquisar" }), "joao");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("João Teste")).toBeInTheDocument();

    await userEvent.clear(screen.getByRole("searchbox", { name: "Pesquisar" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Pesquisar" }), "ninguém");
    expect(screen.getByText("Nenhum processo corresponde a este filtro.")).toBeInTheDocument();
  });
});
