// Painel da equipa: tipos das linhas que o portal lê, estados, filtros e alertas da lista de
// processos. Funções puras (testadas à parte); as regras de acesso estão na RLS.

export type ProcessStatus =
  | "new"
  | "proposal_sent"
  | "awaiting_payment"
  | "awaiting_documents"
  | "in_progress"
  | "completed"
  | "cancelled";

export const PROCESS_STATUSES: ProcessStatus[] = [
  "new",
  "proposal_sent",
  "awaiting_payment",
  "awaiting_documents",
  "in_progress",
  "completed",
  "cancelled",
];

/** Filtros da lista: "open" = todos os que não estão concluídos nem cancelados. */
export type ProcessFilter = "open" | "all" | ProcessStatus;

export const PROCESS_FILTERS: ProcessFilter[] = [
  "open",
  "new",
  "proposal_sent",
  "awaiting_payment",
  "awaiting_documents",
  "in_progress",
  "completed",
  "cancelled",
  "all",
];

export type Relationship = "holder" | "spouse" | "child" | "other";
export type ProposalStatus = "draft" | "sent" | "accepted" | "expired" | "declined";
export type PaymentStatus = "pending" | "partial" | "paid";

export interface ProcessListRow {
  id: string;
  status: ProcessStatus;
  plan_name: string | null;
  created_at: string;
  client: { id: string; full_name: string; email: string } | null;
  payments: { status: PaymentStatus; due_on: string | null }[];
  document_requests: { status: string }[];
  deadlines: { due_on: string; status: string }[];
}

export interface ProcessAlerts {
  /** Documentos enviados pelo cliente à espera de validação. */
  documentsToReview: number;
  /** Pagamentos por receber com data limite já passada. */
  overduePayments: number;
  /** Prazos abertos que vencem nos próximos dias (ou já venceram). */
  upcomingDeadlines: number;
}

/** Dias considerados "prazo próximo" na lista de processos. */
export const UPCOMING_DEADLINE_DAYS = 30;

/** Data de hoje (AAAA-MM-DD) num fuso horário. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Soma dias a uma data AAAA-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function processAlerts(row: Pick<ProcessListRow, "payments" | "document_requests" | "deadlines">, today: string): ProcessAlerts {
  const limit = addDays(today, UPCOMING_DEADLINE_DAYS);
  return {
    documentsToReview: row.document_requests.filter((r) => r.status === "submitted").length,
    overduePayments: row.payments.filter((p) => p.status !== "paid" && p.due_on !== null && p.due_on < today).length,
    upcomingDeadlines: row.deadlines.filter((d) => (d.status === "open" || d.status === "renewing") && d.due_on <= limit).length,
  };
}

export function hasAlerts(alerts: ProcessAlerts): boolean {
  return alerts.documentsToReview + alerts.overduePayments + alerts.upcomingDeadlines > 0;
}

export function matchesFilter(status: ProcessStatus, filter: ProcessFilter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return status !== "completed" && status !== "cancelled";
  return status === filter;
}

/** Pesquisa sem distinguir maiúsculas nem acentos. */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchesSearch(row: Pick<ProcessListRow, "client" | "plan_name">, search: string): boolean {
  const query = normalizeSearch(search);
  if (!query) return true;
  const haystack = normalizeSearch([row.client?.full_name, row.client?.email, row.plan_name].filter(Boolean).join(" "));
  return haystack.includes(query);
}

/** Lista final: filtro, pesquisa e ordem (com alertas primeiro, depois os mais recentes). */
export function visibleProcesses(rows: ProcessListRow[], filter: ProcessFilter, search: string, today: string) {
  return rows
    .filter((row) => matchesFilter(row.status, filter) && matchesSearch(row, search))
    .map((row) => ({ row, alerts: processAlerts(row, today) }))
    .sort((a, b) => {
      const byAlerts = Number(hasAlerts(b.alerts)) - Number(hasAlerts(a.alerts));
      return byAlerts !== 0 ? byAlerts : b.row.created_at.localeCompare(a.row.created_at);
    });
}

export function countByFilter(rows: Pick<ProcessListRow, "status">[]): Record<ProcessFilter, number> {
  return Object.fromEntries(PROCESS_FILTERS.map((f) => [f, rows.filter((r) => matchesFilter(r.status, f)).length])) as Record<
    ProcessFilter,
    number
  >;
}

// Propostas ----------------------------------------------------------------------------------------

export interface ProposalPlan {
  name: string;
  price_aed: number;
  includes_bank_account: boolean;
}

/** Planos válidos para guardar: nome preenchido, preço positivo, nomes sem repetir. */
export function plansError(plans: ProposalPlan[]): "plans_empty" | "plan_name" | "plan_price" | "plan_duplicate" | null {
  if (plans.length === 0) return "plans_empty";
  if (plans.some((p) => !p.name.trim())) return "plan_name";
  if (plans.some((p) => !(p.price_aed > 0))) return "plan_price";
  const names = plans.map((p) => normalizeSearch(p.name));
  if (new Set(names).size !== names.length) return "plan_duplicate";
  return null;
}

/** Caminho do PDF da proposta no Storage (pasta da organização, que a equipa pode escrever). */
export function proposalPdfPath(orgId: string, processId: string, proposalId: string, fileName: string): string {
  const safe = fileName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    // Sem ".." (o Storage recusa) nem pontos ou traços nas pontas.
    .replace(/\.{2,}/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(-80) || "proposta.pdf";
  return `${orgId}/${processId}/proposals/${proposalId}/${safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`}`;
}

/** Nome do ficheiro (última parte do caminho). */
export function fileNameOf(path: string | null): string | null {
  return path ? (path.split("/").pop() ?? null) : null;
}

// Pagamentos ---------------------------------------------------------------------------------------

export function paymentTotals(payments: { amount_aed: number | string; amount_paid_aed: number | string }[]) {
  const total = payments.reduce((sum, p) => sum + Number(p.amount_aed), 0);
  const paid = payments.reduce((sum, p) => sum + Number(p.amount_paid_aed), 0);
  return { total, paid, outstanding: Math.max(total - paid, 0) };
}

// Dados internos -----------------------------------------------------------------------------------

export interface OtherCost {
  label: string;
  amount_aed: number;
}

export function marginOf(salePrice: number | null, partnerCost: number | null, otherCosts: OtherCost[]): number | null {
  if (salePrice === null) return null;
  return salePrice - (partnerCost ?? 0) - otherCosts.reduce((sum, c) => sum + (Number(c.amount_aed) || 0), 0);
}
