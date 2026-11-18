// Área de cliente: tipos, pendentes do cliente e progresso do percurso por fases. Funções puras
// (testadas à parte); a RLS decide o que o cliente pode ler.
import type { PaymentStatus, ProcessStatus, ProposalPlan, ProposalStatus, Relationship } from "./team";

export type Phase = "documents" | "incorporation" | "residence" | "bank" | "done";
export const PHASES: Phase[] = ["documents", "incorporation", "residence", "bank", "done"];

export interface ClientProcess {
  id: string;
  status: ProcessStatus;
  plan_name: string | null;
  includes_bank_account: boolean;
  company_name_options: string[];
  bank_account_id: string | null;
  bank_details_released_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

/** A API devolve só os dados mínimos antes da aceitação. A RLS protege o acompanhamento. */
export interface ClientPortalProcess extends ClientProcess {
  proposal_accepted: boolean;
}

export interface ClientProposal {
  id: string;
  reference: string;
  pdf_path: string | null;
  plans: ProposalPlan[];
  chosen_plan: string | null;
  valid_until: string | null;
  status: ProposalStatus;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_text: string | null;
}

export interface ClientPayment {
  id: string;
  description: string;
  amount_aed: number;
  amount_paid_aed: number;
  status: PaymentStatus;
  due_on: string | null;
  paid_on: string | null;
}

export interface ClientRequest {
  id: string;
  status: "pending" | "submitted" | "approved" | "rejected";
  rejection_reason: string | null;
  custom_label: string | null;
  person: { full_name: string; relationship: Relationship } | null;
  document_type: { label: Record<string, string> } | null;
}

export interface ClientStep {
  id: string;
  position: number;
  phase: Phase | null;
  title: Record<string, string>;
  status: "todo" | "in_progress" | "done";
  planned_on: string | null;
  done_on: string | null;
  client_note: string | null;
}

export interface ClientDeadline {
  id: string;
  deadline_type: string;
  title: string | null;
  due_on: string;
  status: "open" | "renewing" | "renewed" | "dismissed";
}

/** Texto num idioma (ou pt-PT, ou o primeiro que houver). */
export function localized(text: Record<string, string> | null | undefined, locale: string): string {
  if (!text) return "";
  return text[locale] ?? text["pt-PT"] ?? Object.values(text)[0] ?? "";
}

export type PendingKind = "accept_proposal" | "send_documents" | "fix_documents" | "pay" | "company_names";

export interface PendingItem {
  kind: PendingKind;
  count?: number;
}

/** O que falta da parte do cliente, por ordem de urgência. */
export function pendingForClient(input: {
  process: Pick<ClientProcess, "status" | "company_name_options" | "completed_at" | "cancelled_at">;
  proposals: Pick<ClientProposal, "status" | "valid_until">[];
  payments: Pick<ClientPayment, "status">[];
  requests: Pick<ClientRequest, "status">[];
  today: string;
}): PendingItem[] {
  const { process, proposals, payments, requests, today } = input;
  if (process.completed_at || process.cancelled_at) return [];
  const items: PendingItem[] = [];
  const accepted = proposals.some((p) => p.status === "accepted");
  const open = proposals.filter((p) => p.status === "sent" && (!p.valid_until || p.valid_until >= today));
  if (!accepted && open.length > 0) items.push({ kind: "accept_proposal" });
  if (accepted && payments.some((p) => p.status !== "paid")) items.push({ kind: "pay" });
  const rejected = requests.filter((r) => r.status === "rejected").length;
  if (rejected > 0) items.push({ kind: "fix_documents", count: rejected });
  const pending = requests.filter((r) => r.status === "pending").length;
  if (pending > 0) items.push({ kind: "send_documents", count: pending });
  if (process.company_name_options.length === 0) items.push({ kind: "company_names" });
  return items;
}

export interface PhaseProgress {
  phase: Phase;
  done: number;
  total: number;
  steps: ClientStep[];
  state: "done" | "current" | "upcoming";
}

/** Passos agrupados por fase, com a fase atual (a primeira que ainda não terminou). */
export function phaseProgress(steps: ClientStep[]): { phases: PhaseProgress[]; current: ClientStep | null; percent: number } {
  const sorted = [...steps].sort((a, b) => PHASES.indexOf(a.phase ?? "incorporation") - PHASES.indexOf(b.phase ?? "incorporation") || a.position - b.position);
  const groups = PHASES.map((phase) => ({ phase, steps: sorted.filter((s) => (s.phase ?? "incorporation") === phase) }))
    .filter((g) => g.steps.length > 0);
  let currentFound = false;
  const phases: PhaseProgress[] = groups.map((g) => {
    const done = g.steps.filter((s) => s.status === "done").length;
    let state: PhaseProgress["state"] = "upcoming";
    if (done === g.steps.length) state = "done";
    else if (!currentFound) {
      state = "current";
      currentFound = true;
    }
    return { phase: g.phase, done, total: g.steps.length, steps: g.steps, state };
  });
  const current = sorted.find((s) => s.status !== "done") ?? null;
  const doneCount = sorted.filter((s) => s.status === "done").length;
  return { phases, current, percent: sorted.length ? Math.round((doneCount / sorted.length) * 100) : 0 };
}

/** Prazos abertos por ordem de data (os mais próximos primeiro). */
export function upcomingDeadlines(deadlines: ClientDeadline[], limit = 3): ClientDeadline[] {
  return deadlines
    .filter((d) => d.status === "open" || d.status === "renewing")
    .sort((a, b) => a.due_on.localeCompare(b.due_on))
    .slice(0, limit);
}

/** Dias entre hoje e uma data (negativo se já passou). */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
