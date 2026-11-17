import { describe, expect, it } from "vitest";
import { type ClientStep, daysUntil, localized, pendingForClient, phaseProgress, upcomingDeadlines } from "./client";

const TODAY = "2026-11-18";
const open = { status: "proposal_sent" as const, company_name_options: ["Alfa"], completed_at: null, cancelled_at: null };

function step(position: number, phase: ClientStep["phase"], status: ClientStep["status"]): ClientStep {
  return { id: `s${position}`, position, phase, title: { "pt-PT": `Passo ${position}` }, status, planned_on: null, done_on: null, client_note: null };
}

describe("pendentes do cliente", () => {
  it("proposta enviada e válida → aceitar; nomes em falta", () => {
    const items = pendingForClient({
      process: { ...open, company_name_options: [] },
      proposals: [{ status: "sent", valid_until: "2026-12-01" }],
      payments: [],
      requests: [],
      today: TODAY,
    });
    expect(items.map((i) => i.kind)).toEqual(["accept_proposal", "company_names"]);
  });

  it("proposta expirada por data não pede aceitação", () => {
    const items = pendingForClient({ process: open, proposals: [{ status: "sent", valid_until: "2026-11-01" }], payments: [], requests: [], today: TODAY });
    expect(items).toEqual([]);
  });

  it("depois de aceitar: pagamento por fazer e documentos (rejeitados primeiro)", () => {
    const items = pendingForClient({
      process: open,
      proposals: [{ status: "accepted", valid_until: null }],
      payments: [{ status: "paid" }, { status: "pending" }],
      requests: [{ status: "pending" }, { status: "rejected" }, { status: "pending" }, { status: "approved" }],
      today: TODAY,
    });
    expect(items).toEqual([{ kind: "pay" }, { kind: "fix_documents", count: 1 }, { kind: "send_documents", count: 2 }]);
  });

  it("processo concluído não tem pendentes", () => {
    expect(pendingForClient({ process: { ...open, completed_at: "2026-11-01" }, proposals: [], payments: [], requests: [{ status: "pending" }], today: TODAY })).toEqual([]);
  });
});

describe("percurso por fases", () => {
  it("agrupa por fase, marca a fase atual e calcula a percentagem", () => {
    const { phases, current, percent } = phaseProgress([
      step(30, "documents", "done"),
      step(10, "documents", "done"),
      step(40, "incorporation", "in_progress"),
      step(50, "incorporation", "todo"),
      step(70, "residence", "todo"),
      step(130, "done", "todo"),
    ]);
    expect(phases.map((p) => [p.phase, p.state, p.done, p.total])).toEqual([
      ["documents", "done", 2, 2],
      ["incorporation", "current", 0, 2],
      ["residence", "upcoming", 0, 1],
      ["done", "upcoming", 0, 1],
    ]);
    expect(current?.id).toBe("s40");
    expect(percent).toBe(33);
  });

  it("passos sem fase ficam na constituição; sem passos dá 0%", () => {
    expect(phaseProgress([step(1, null, "todo")]).phases[0].phase).toBe("incorporation");
    expect(phaseProgress([]).percent).toBe(0);
  });
});

describe("utilitários", () => {
  it("próximos prazos abertos, por data", () => {
    const rows = [
      { id: "a", deadline_type: "licence", title: null, due_on: "2027-03-01", status: "open" as const },
      { id: "b", deadline_type: "emirates_id", title: null, due_on: "2026-12-01", status: "renewing" as const },
      { id: "c", deadline_type: "other", title: null, due_on: "2026-11-20", status: "renewed" as const },
    ];
    expect(upcomingDeadlines(rows).map((d) => d.id)).toEqual(["b", "a"]);
  });
  it("dias até uma data e texto localizado", () => {
    expect(daysUntil("2026-11-28", TODAY)).toBe(10);
    expect(daysUntil("2026-11-17", TODAY)).toBe(-1);
    expect(localized({ "pt-PT": "Olá", en: "Hello" }, "en")).toBe("Hello");
    expect(localized({ "pt-PT": "Olá" }, "fr")).toBe("Olá");
  });
});
