// Dados da área de cliente: processo escolhido (se houver mais de um) e as leituras de cada página.
// Tudo passa pela RLS: o cliente só lê o que é seu, e nunca nomes da equipa nem dados internos.
import { useQuery } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { ClientDeadline, ClientPayment, ClientProcess, ClientProposal, ClientRequest, ClientStep } from "./client";
import { supabase } from "./supabase";

const KEY = "portal.process";
const listeners = new Set<() => void>();

function readChoice(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Processos do cliente e o escolhido (o mais recente por omissão). */
export function useClientProcesses() {
  const choice = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readChoice,
    () => null,
  );
  const query = useQuery({
    queryKey: ["client-processes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processes")
        .select("id, status, plan_name, includes_bank_account, company_name_options, bank_account_id, bank_details_released_at, completed_at, cancelled_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientProcess[];
    },
  });
  const list = query.data ?? [];
  const current = list.find((p) => p.id === choice) ?? list[0] ?? null;
  const choose = useCallback((id: string) => {
    try {
      sessionStorage.setItem(KEY, id);
    } catch {
      // sem armazenamento: fica o mais recente
    }
    listeners.forEach((l) => l());
  }, []);
  return { query, list, current, choose };
}

function useProcessTable<T>(table: string, columns: string, processId: string | undefined, order: string, ascending = true) {
  return useQuery({
    queryKey: ["client", table, processId],
    enabled: !!processId,
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select(columns).eq("process_id", processId!).order(order, { ascending });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export const useClientProposals = (processId?: string) =>
  useProcessTable<ClientProposal>(
    "proposals",
    "id, reference, pdf_path, plans, chosen_plan, valid_until, status, sent_at, accepted_at, accepted_text",
    processId,
    "created_at",
    false,
  );

export const useClientPayments = (processId?: string) =>
  useProcessTable<ClientPayment>("payments", "id, description, amount_aed, amount_paid_aed, status, due_on, paid_on", processId, "created_at");

export const useClientRequests = (processId?: string) =>
  useProcessTable<ClientRequest>(
    "document_requests",
    "id, status, rejection_reason, custom_label, person:people(full_name, relationship), document_type:document_types(label)",
    processId,
    "created_at",
  );

export const useClientSteps = (processId?: string) =>
  useProcessTable<ClientStep>("timeline_steps", "id, position, phase, title, status, planned_on, done_on, client_note", processId, "position");

export const useClientDeadlines = (processId?: string) =>
  useProcessTable<ClientDeadline>("deadlines", "id, deadline_type, title, due_on, status", processId, "due_on");
