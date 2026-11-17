import type { ClientDeadline, ClientStep } from "./client";
import { daysUntil } from "./client";

export const DEADLINE_TYPES = ["licence", "office_contract", "establishment_card", "residence_visa", "emirates_id", "other"] as const;
export type DeadlineType = typeof DEADLINE_TYPES[number];
export interface Deadline extends ClientDeadline {
  process_id: string;
  person_id: string | null;
  document_id: string | null;
  updated_at: string;
  person: { full_name: string } | null;
  document: { id: string; file_name: string; purged_at: string | null } | null;
  process?: { id: string; client: { full_name: string } | null } | null;
}
export interface TeamStep extends ClientStep { auto_event: string | null; updated_at: string }
export const isActiveDeadline = (d: Pick<ClientDeadline, "status">) => d.status === "open" || d.status === "renewing";

/** Dates are civil dates. UTC arithmetic avoids daylight-saving and browser timezone shifts. */
export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function monthStart(date: string): string { return date.slice(0, 7) + "-01"; }
export function shiftMonth(date: string, amount: number): string {
  const value = new Date(`${monthStart(date)}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + amount);
  return value.toISOString().slice(0, 10);
}
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
export function monthDays(month: string): string[] {
  const first = weekStart(monthStart(month));
  const last = addDays(shiftMonth(month, 1), -1);
  const end = addDays(weekStart(last), 6);
  return Array.from({ length: daysUntil(end, first) + 1 }, (_, index) => addDays(first, index));
}
export function deadlineCounts(rows: ClientDeadline[], today: string) {
  const active = rows.filter(isActiveDeadline);
  return {
    overdue: active.filter((d) => d.due_on < today).length,
    soon: active.filter((d) => d.due_on >= today && d.due_on <= addDays(today, 30)).length,
    renewing: active.filter((d) => d.status === "renewing").length,
    active: active.length,
  };
}
export function groupWeeks<T extends ClientDeadline>(rows: T[]): { start: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const row of [...rows].sort((a, b) => a.due_on.localeCompare(b.due_on) || a.id.localeCompare(b.id))) {
    const start = weekStart(row.due_on);
    groups.set(start, [...(groups.get(start) ?? []), row]);
  }
  return [...groups].map(([start, items]) => ({ start, items }));
}
