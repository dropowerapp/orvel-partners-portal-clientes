import { describe, expect, it } from "vitest";
import {
  addDays,
  countByFilter,
  fileNameOf,
  marginOf,
  matchesFilter,
  matchesSearch,
  paymentTotals,
  plansError,
  processAlerts,
  type ProcessListRow,
  proposalPdfPath,
  todayIn,
  visibleProcesses,
} from "./team";

const TODAY = "2026-11-17";

function row(over: Partial<ProcessListRow> = {}): ProcessListRow {
  return {
    id: "p1",
    status: "new",
    plan_name: null,
    created_at: "2026-11-01T10:00:00Z",
    client: { id: "c1", full_name: "Rui Fictício", email: "rui.ficticio@exemplo.test" },
    payments: [],
    document_requests: [],
    deadlines: [],
    ...over,
  };
}

describe("datas", () => {
  it("hoje no fuso da organização (Dubai está 4 h à frente de UTC)", () => {
    expect(todayIn("Asia/Dubai", new Date("2026-11-17T21:30:00Z"))).toBe("2026-11-18");
    expect(todayIn("Europe/Lisbon", new Date("2026-11-17T21:30:00Z"))).toBe("2026-11-17");
  });
  it("soma dias, mesmo a mudar de mês e de ano", () => {
    expect(addDays("2026-12-20", 30)).toBe("2027-01-19");
  });
});

describe("alertas", () => {
  it("conta documentos por validar, pagamentos em atraso e prazos próximos", () => {
    const alerts = processAlerts(
      row({
        document_requests: [{ status: "submitted" }, { status: "pending" }, { status: "submitted" }],
        payments: [
          { status: "pending", due_on: "2026-11-10" },
          { status: "partial", due_on: "2026-11-16" },
          { status: "paid", due_on: "2026-11-01" },
          { status: "pending", due_on: TODAY },
          { status: "pending", due_on: null },
        ],
        deadlines: [
          { status: "open", due_on: "2026-12-17" },
          { status: "renewing", due_on: "2026-11-01" },
          { status: "open", due_on: "2026-12-18" },
          { status: "renewed", due_on: "2026-11-20" },
        ],
      }),
      TODAY,
    );
    expect(alerts).toEqual({ documentsToReview: 2, overduePayments: 2, upcomingDeadlines: 2 });
  });
});

describe("filtros e pesquisa", () => {
  it("'em aberto' exclui concluídos e cancelados", () => {
    expect(matchesFilter("in_progress", "open")).toBe(true);
    expect(matchesFilter("completed", "open")).toBe(false);
    expect(matchesFilter("cancelled", "open")).toBe(false);
    expect(matchesFilter("cancelled", "all")).toBe(true);
    expect(matchesFilter("awaiting_payment", "awaiting_payment")).toBe(true);
    expect(matchesFilter("awaiting_payment", "new")).toBe(false);
  });

  it("pesquisa sem acentos nem maiúsculas, no nome, email e plano", () => {
    expect(matchesSearch(row(), "ficticio")).toBe(true);
    expect(matchesSearch(row(), "RUI.FIC")).toBe(true);
    expect(matchesSearch(row({ plan_name: "Essencial" }), "essen")).toBe(true);
    expect(matchesSearch(row(), "marta")).toBe(false);
    expect(matchesSearch(row(), "  ")).toBe(true);
  });

  it("conta os processos de cada filtro", () => {
    const counts = countByFilter([{ status: "new" }, { status: "completed" }, { status: "in_progress" }]);
    expect(counts.open).toBe(2);
    expect(counts.all).toBe(3);
    expect(counts.completed).toBe(1);
    expect(counts.cancelled).toBe(0);
  });

  it("ordena com alertas primeiro e depois os mais recentes", () => {
    const rows = [
      row({ id: "antigo", created_at: "2026-10-01T00:00:00Z" }),
      row({ id: "recente", created_at: "2026-11-10T00:00:00Z" }),
      row({ id: "com-alerta", created_at: "2026-09-01T00:00:00Z", document_requests: [{ status: "submitted" }] }),
      row({ id: "concluido", status: "completed", created_at: "2026-11-15T00:00:00Z" }),
    ];
    expect(visibleProcesses(rows, "open", "", TODAY).map((v) => v.row.id)).toEqual(["com-alerta", "recente", "antigo"]);
  });
});

describe("propostas", () => {
  it("valida os planos", () => {
    expect(plansError([])).toBe("plans_empty");
    expect(plansError([{ name: " ", price_aed: 10, includes_bank_account: false }])).toBe("plan_name");
    expect(plansError([{ name: "Base", price_aed: 0, includes_bank_account: false }])).toBe("plan_price");
    expect(
      plansError([
        { name: "Básico", price_aed: 10, includes_bank_account: false },
        { name: "basico", price_aed: 20, includes_bank_account: true },
      ]),
    ).toBe("plan_duplicate");
    expect(plansError([{ name: "Completo", price_aed: 15000, includes_bank_account: true }])).toBeNull();
  });

  it("guarda o PDF na pasta da organização, com um nome seguro", () => {
    expect(proposalPdfPath("org", "proc", "prop", "Proposta Orvel – João.pdf")).toBe("org/proc/proposals/prop/Proposta-Orvel-Joao.pdf");
    expect(proposalPdfPath("org", "proc", "prop", "../../x")).toBe("org/proc/proposals/prop/x.pdf");
    expect(proposalPdfPath("org", "proc", "prop", "versao..final.PDF")).toBe("org/proc/proposals/prop/versao.final.PDF");
    expect(fileNameOf("org/proc/proposals/prop/a.pdf")).toBe("a.pdf");
    expect(fileNameOf(null)).toBeNull();
  });
});

describe("valores", () => {
  it("totais dos pagamentos (valores da base de dados podem vir como texto)", () => {
    expect(
      paymentTotals([
        { amount_aed: "1000.00", amount_paid_aed: "1000.00" },
        { amount_aed: 500, amount_paid_aed: 200 },
      ]),
    ).toEqual({ total: 1500, paid: 1200, outstanding: 300 });
  });

  it("margem: preço de venda menos custos", () => {
    expect(marginOf(10000, 6000, [{ label: "Taxas", amount_aed: 500 }])).toBe(3500);
    expect(marginOf(10000, null, [])).toBe(10000);
    expect(marginOf(null, 6000, [])).toBeNull();
  });
});
