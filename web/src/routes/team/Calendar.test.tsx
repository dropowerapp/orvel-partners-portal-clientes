import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "../../test/fixtures";
import Calendar from "./Calendar";

vi.mock("../../lib/supabase", () => ({ supabase: {} }));
vi.mock("../../lib/teamData", async (importOriginal) => ({ ...await importOriginal<typeof import("../../lib/teamData")>(), useTeamSettings: () => ({ today: "2026-11-17" }) }));
vi.mock("../../lib/scheduleData", () => ({ useDeadlines: () => ({ isSuccess: true, data: [
  { id: "today", due_on: "2026-11-17", status: "open", deadline_type: "licence", title: "Licença atual", process_id: "p1", process: { client: { full_name: "Marta Exemplo" } } },
  { id: "edge", due_on: "2027-02-14", status: "renewing", deadline_type: "licence", title: "Último dia dos 90", process_id: "p2", process: { client: { full_name: "Rui Fictício" } } },
  { id: "outside", due_on: "2027-02-15", status: "open", deadline_type: "licence", title: "Fora dos 90 dias", process_id: "p3" },
  { id: "overdue", due_on: "2026-10-01", status: "open", deadline_type: "licence", title: "Prazo vencido", process_id: "p1" },
] }) }));

describe("calendário da equipa", () => {
  it("mostra o dia selecionado e permite pesquisar clientes", async () => {
    const user = userEvent.setup();
    renderAt("/test", <Calendar />);
    expect(screen.getByText("Licença atual")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^17.+2026: 1 prazo$/ })).toHaveAttribute("aria-current", "date");
    await user.type(screen.getByLabelText("Pesquisar cliente ou prazo"), "sem resultados");
    expect(screen.queryByText("Licença atual")).not.toBeInTheDocument();
    expect(screen.getByText("Sem prazos neste dia.")).toBeInTheDocument();
  });
  it("inclui exatamente os 90 dias e mantém os vencidos separados", async () => {
    const user = userEvent.setup();
    renderAt("/test", <Calendar />);
    await user.click(screen.getByRole("button", { name: "Próximos 90 dias" }));
    expect(screen.getByText("Último dia dos 90")).toBeInTheDocument();
    expect(screen.queryByText("Fora dos 90 dias")).not.toBeInTheDocument();
    expect(screen.getByText("Prazo vencido")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rui Fictício" })).toHaveAttribute("href", "/equipa/processos/p2/prazos");
  });
});
