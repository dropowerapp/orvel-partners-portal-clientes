// E2 · Processos: lista com filtros por estado, pesquisa e alertas (documentos por validar,
// pagamentos em atraso, prazos próximos).
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Alert, Badge, PageTitle, Spinner } from "../../components/ui";
import { useOrg } from "../../lib/OrgProvider";
import { supabase } from "../../lib/supabase";
import {
  countByFilter,
  PROCESS_FILTERS,
  type ProcessFilter,
  type ProcessListRow,
  UPCOMING_DEADLINE_DAYS,
  visibleProcesses,
} from "../../lib/team";
import { TEAM_PATHS, useFormat, useTeamSettings } from "../../lib/teamData";
import { ProcessStatusBadge } from "./ProcessStatusBadge";

export const PROCESS_LIST_SELECT =
  "id, status, plan_name, created_at, client:clients(id, full_name, email), payments(status, due_on), " +
  "document_requests(status), deadlines(due_on, status)";

export default function ProcessList() {
  const { t } = useTranslation();
  const org = useOrg();
  const format = useFormat();
  const { today } = useTeamSettings();
  const [filter, setFilter] = useState<ProcessFilter>("open");
  const [search, setSearch] = useState("");

  const processes = useQuery({
    queryKey: ["team-processes", org.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processes")
        .select(PROCESS_LIST_SELECT)
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProcessListRow[];
    },
  });

  const rows = processes.data ?? [];
  const counts = countByFilter(rows);
  const visible = visibleProcesses(rows, filter, search, today);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle eyebrow={t("auth_layout.eyebrow_team")} title={t("processes.title")}>
          {t("processes.intro")}
        </PageTitle>
        <Link
          to={TEAM_PATHS.newProcess}
          className="inline-flex items-center justify-center rounded-md bg-action px-4 py-2.5 font-semibold text-white hover:bg-primary"
        >
          {t("processes.new")}
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div role="group" aria-label={t("processes.filter_label")} className="flex flex-wrap gap-2">
          {PROCESS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                filter === f ? "border-action bg-action text-white" : "border-line bg-white text-primary hover:bg-background"
              }`}
            >
              {t(`processes.filter.${f}`)} <span className="opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold text-primary lg:w-72">
          {t("processes.search")}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("processes.search_placeholder")}
            className="rounded-md border border-line bg-white px-3 py-2 text-base font-normal focus:border-action focus:outline-2 focus:outline-action/30"
          />
        </label>
      </div>

      {processes.isPending && <Spinner />}
      {processes.isError && <Alert>{t("processes.load_error")}</Alert>}
      {processes.isSuccess && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-white px-5 py-8 text-center text-muted">
          {t("processes.empty")}
        </div>
      )}
      {processes.isSuccess && rows.length > 0 && visible.length === 0 && (
        <p className="text-muted">{t("processes.no_match")}</p>
      )}
      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-background text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">{t("processes.col_client")}</th>
                <th className="px-4 py-3">{t("processes.col_status")}</th>
                <th className="px-4 py-3">{t("processes.col_plan")}</th>
                <th className="px-4 py-3">{t("processes.col_alerts")}</th>
                <th className="px-4 py-3">{t("processes.col_created")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row, alerts }) => (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <Link to={TEAM_PATHS.process(row.id)} className="font-semibold text-primary hover:underline">
                      {row.client?.full_name ?? t("processes.no_client")}
                    </Link>
                    <span className="block text-xs text-muted">{row.client?.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ProcessStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">{row.plan_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {alerts.documentsToReview > 0 && (
                        <Badge tone="warning">{t("processes.alert_documents", { count: alerts.documentsToReview })}</Badge>
                      )}
                      {alerts.overduePayments > 0 && (
                        <Badge tone="danger">{t("processes.alert_payments", { count: alerts.overduePayments })}</Badge>
                      )}
                      {alerts.upcomingDeadlines > 0 && (
                        <Badge tone="warning">
                          {t("processes.alert_deadlines", { count: alerts.upcomingDeadlines, days: UPCOMING_DEADLINE_DAYS })}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{format.date(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
