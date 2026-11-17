// E4 · Ficha do processo: cabeçalho, separadores e dados partilhados pelos separadores.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from "react-router";
import { Alert, Eyebrow, Spinner } from "../../../components/ui";
import { supabase } from "../../../lib/supabase";
import type { ProcessStatus } from "../../../lib/team";
import { TEAM_PATHS, useFormat } from "../../../lib/teamData";
import type { ProcessFlash } from "../NewProcess";
import { ProcessStatusBadge } from "../ProcessStatusBadge";

export interface ProcessClient {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  address_line: string | null;
  city: string | null;
  postal_code: string | null;
  address_country: string | null;
  locale: string;
  invited_at: string | null;
  last_invite_sent_at: string | null;
}

export interface ProcessDetail {
  id: string;
  organization_id: string;
  client_id: string;
  status: ProcessStatus;
  plan_name: string | null;
  includes_bank_account: boolean;
  free_zone: string | null;
  visa_count: number | null;
  company_name_options: string[];
  bank_account_id: string | null;
  bank_details_released_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  client: ProcessClient;
}

export interface ProcessContext {
  process: ProcessDetail;
  /** Volta a ler o processo (depois de alterações que mudam o estado). */
  refresh: () => Promise<void>;
  /** Mensagem no topo da ficha. */
  setFlash: (flash: ProcessFlash | null) => void;
  /** Processo concluído ou cancelado: a ficha fica só para leitura. */
  closed: boolean;
}

export function useProcess(): ProcessContext {
  return useOutletContext<ProcessContext>();
}

export const PROCESS_SELECT =
  "id, organization_id, client_id, status, plan_name, includes_bank_account, free_zone, visa_count, company_name_options, " +
  "bank_account_id, bank_details_released_at, completed_at, cancelled_at, created_at, " +
  "client:clients(id, full_name, email, phone, country, address_line, city, postal_code, address_country, locale, invited_at, last_invite_sent_at)";

const TABS = [
  { path: "", key: "summary" },
  { path: "pessoas", key: "people" },
  { path: "proposta", key: "proposal" },
  { path: "pagamentos", key: "payments" },
  { path: "documentos", key: "documents" },
  { path: "percurso", key: "timeline" },
  { path: "prazos", key: "deadlines" },
  { path: "interno", key: "internal" },
  { path: "atividade", key: "activity" },
] as const;

export default function ProcessLayout() {
  const { t } = useTranslation();
  const format = useFormat();
  const { processId = "" } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState<ProcessFlash | null>((location.state as { flash?: ProcessFlash } | null)?.flash ?? null);

  // A mensagem que veio da navegação (ex.: "processo criado") só aparece uma vez.
  useEffect(() => {
    if ((location.state as { flash?: ProcessFlash } | null)?.flash) window.history.replaceState({}, "");
  }, [location.state]);

  const query = useQuery({
    queryKey: ["team-process", processId],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select(PROCESS_SELECT).eq("id", processId).single();
      if (error) throw error;
      return data as unknown as ProcessDetail;
    },
  });

  if (query.isPending) return <Spinner />;
  if (query.isError || !query.data) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>{t("errors.not_found")}</Alert>
        <Link to={TEAM_PATHS.processes} className="font-semibold text-action hover:underline">
          {t("process.back_to_list")}
        </Link>
      </div>
    );
  }

  const process = query.data;
  const base = TEAM_PATHS.process(process.id);
  const context: ProcessContext = {
    process,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ["team-process", process.id] });
      void queryClient.invalidateQueries({ queryKey: ["team-processes"] });
    },
    setFlash,
    closed: process.completed_at !== null || process.cancelled_at !== null,
  };

  return (
    <>
      <Link to={TEAM_PATHS.processes} className="mb-4 inline-block text-sm font-semibold text-action hover:underline">
        {t("process.back_to_list")}
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{t("process.eyebrow")}</Eyebrow>
          <h1 className="text-3xl leading-tight font-light text-primary">{process.client.full_name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <ProcessStatusBadge status={process.status} />
            <span>{process.plan_name ?? t("process.no_plan")}</span>
            <span aria-hidden="true">·</span>
            <span>{t("process.created_on", { date: format.date(process.created_at) })}</span>
          </p>
        </div>
      </div>

      <nav aria-label={t("process.tabs_label")} className="mb-6 border-b border-line">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <li key={tab.key}>
              <NavLink
                to={tab.path ? `${base}/${tab.path}` : base}
                end={!tab.path}
                className={({ isActive }) =>
                  `block border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap ${
                    isActive ? "border-action text-primary" : "border-transparent text-muted hover:text-primary"
                  }`}
              >
                {t(`process.tabs.${tab.key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {flash && (
        <div className="mb-4">
          <Alert tone={flash.tone}>{flash.text}</Alert>
        </div>
      )}
      {context.closed && (
        <div className="mb-4">
          <Alert tone="info">{t("process.closed_notice")}</Alert>
        </div>
      )}

      <Outlet context={context} />
    </>
  );
}
