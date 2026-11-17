import { describe, expect, it } from "vitest";
import { addDays, deadlineCounts, groupWeeks, monthDays, shiftMonth, weekStart } from "./schedule";
import { phaseProgress, type ClientDeadline, type ClientStep } from "./client";

const deadline = (id: string, due_on: string, status: ClientDeadline["status"] = "open"): ClientDeadline => ({ id, due_on, status, title: null, deadline_type: "licence" });
describe("calendário e prazos", () => {
  it("mantém datas civis ao atravessar meses, anos e horário de verão", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(shiftMonth("2026-01-31", 1)).toBe("2026-02-01");
  });
  it("alinha semanas à segunda e inclui todos os dias do mês", () => {
    const days = monthDays("2026-11-01");
    expect(days[0]).toBe("2026-10-26");
    expect(days.at(-1)).toBe("2026-12-06");
    expect(days).toHaveLength(42);
    expect(weekStart("2027-01-03")).toBe("2026-12-28");
  });
  it("separa vencidos de hoje, conta os 30 dias inclusive e exclui o histórico", () => {
    expect(deadlineCounts([
      deadline("old", "2026-11-16", "renewing"), deadline("today", "2026-11-17"),
      deadline("30", "2026-12-17"), deadline("31", "2026-12-18"),
      deadline("renewed", "2025-01-01", "renewed"), deadline("dismissed", "2026-11-18", "dismissed"),
    ], "2026-11-17")).toEqual({ overdue: 1, soon: 2, renewing: 1, active: 4 });
  });
  it("agrupa e ordena por semana sem alterar os dados recebidos", () => {
    const rows = [deadline("a", "2027-01-04"), deadline("b", "2026-12-31"), deadline("c", "2027-01-03")];
    expect(groupWeeks(rows).map((g) => [g.start, g.items.map((d) => d.id)])).toEqual([["2026-12-28", ["b", "c"]], ["2027-01-04", ["a"]]]);
    expect(rows[0].id).toBe("a");
  });
  it("um passo acrescentado numa fase anterior torna-se o próximo passo", () => {
    const step = { title: {}, status: "todo", planned_on: null, done_on: null, client_note: null } as const;
    const steps: ClientStep[] = [{ ...step, id: "older", phase: "residence", position: 10 }, { ...step, id: "new", phase: "documents", position: 200 }];
    expect(phaseProgress(steps).current?.id).toBe("new");
  });
});
