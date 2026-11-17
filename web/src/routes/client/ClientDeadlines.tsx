import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DeadlineBadge, DeadlineDownload, ScheduleEmpty, ScheduleStats } from "../../components/ScheduleUI";
import { Alert, Card, PageTitle, Spinner } from "../../components/ui";
import { useClientProcesses } from "../../lib/clientData";
import { isActiveDeadline } from "../../lib/schedule";
import { useDeadlines } from "../../lib/scheduleData";
import { todayIn } from "../../lib/team";
import { useFormat } from "../../lib/teamData";

export default function ClientDeadlines() {
  const { t } = useTranslation();
  const format = useFormat();
  const today = todayIn("Asia/Dubai");
  const { current } = useClientProcesses();
  const query = useDeadlines(current?.id);
  const [history, setHistory] = useState(false);
  const rows = (query.data ?? []).filter((row) => history ? row.status === "renewed" : isActiveDeadline(row));
  return <>
    <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={t("client_deadlines.title")}>{t("client_deadlines.intro")}</PageTitle>
    <div className="flex flex-col gap-6">
      {query.isPending && current && <Spinner />}{query.isError && <Alert>{t("client_deadlines.load_error")}</Alert>}
      {query.isSuccess && <ScheduleStats rows={query.data} today={today} />}
      <div role="group" aria-label={t("schedule.filter")} className="inline-flex self-start rounded-xl border border-line bg-white p-1">
        {[false, true].map((value) => <button key={String(value)} aria-pressed={history === value} onClick={() => setHistory(value)} className={"rounded-lg px-4 py-2 text-sm font-semibold " + (history === value ? "bg-primary text-white" : "text-muted")}>{t(value ? "schedule.renewed_history" : "schedule.active")}</button>)}
      </div>
      {query.isSuccess && <Card>
        {!rows.length ? <ScheduleEmpty title={t(history ? "schedule.no_history" : "schedule.empty")} body={t("client_deadlines.empty")} /> : <ul className="divide-y divide-line">
          {rows.map((row) => <li key={row.id} className="py-5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold">{row.title || t("deadline_type." + row.deadline_type)}</h2>
                <p className="mt-1 text-sm text-muted">{format.date(row.due_on)}<span aria-hidden="true"> · </span>{row.person?.full_name || t("schedule.company")}</p></div>
              <DeadlineBadge deadline={row} today={today} />
            </div>
            {row.document && <div className="mt-4"><DeadlineDownload document={row.document} /></div>}
          </li>)}
        </ul>}
      </Card>}
      <p className="text-xs leading-relaxed text-muted">{t("client_deadlines.disclaimer")}</p>
    </div>
  </>;
}
