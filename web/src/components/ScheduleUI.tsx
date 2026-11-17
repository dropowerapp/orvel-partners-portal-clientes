import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Link } from "react-router";
import { daysUntil } from "../lib/client";
import { deadlineCounts, type Deadline } from "../lib/schedule";
import type { ClientDeadline } from "../lib/client";
import { openDownload } from "../lib/download";
import { TEAM_PATHS, useFormat } from "../lib/teamData";
import { Icon } from "./Icon";
import { Alert, Badge, Button } from "./ui";

export function DeadlineBadge({ deadline, today }: { deadline: ClientDeadline; today: string }) {
  const { t } = useTranslation();
  const days = daysUntil(deadline.due_on, today);
  const status = deadline.status;
  const tone = status === "renewed" ? "success" : status === "dismissed" ? "neutral" : days < 0 ? "danger" : days <= 30 ? "warning" : "info";
  return <div className="flex flex-wrap items-center gap-2">
    <Badge tone={tone}>{status === "renewed" || status === "dismissed" ? t("deadline_status." + status)
      : days < 0 ? t("schedule.overdue_days", { count: -days }) : days === 0 ? t("schedule.today") : t("client_deadlines.in_days", { days })}</Badge>
    {status === "renewing" && <Badge tone="info">{t("deadline_status.renewing")}</Badge>}
  </div>;
}
export function ScheduleStats({ rows, today }: { rows: ClientDeadline[]; today: string }) {
  const { t } = useTranslation();
  const counts = deadlineCounts(rows, today);
  return <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {(["overdue", "soon", "renewing", "active"] as const).map((key) => <div key={key} className="portal-card flex items-center justify-between gap-3 px-5 py-4">
      <dt className="text-sm text-muted">{t(`schedule.stats.${key}`)}</dt>
      <dd className={"text-2xl font-light tabular-nums " + (key === "overdue" && counts[key] ? "text-red-800" : "text-primary")}>{counts[key]}</dd>
    </div>)}
  </dl>;
}
export function ScheduleEmpty({ title, body }: { title: string; body?: string }) {
  return <div className="py-10 text-center">
    <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-background text-wordmark"><Icon name="calendar" className="size-6" /></span>
    <p className="font-semibold">{title}</p>{body && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
  </div>;
}
export function DeadlineList({ rows, today, showClient = false }: { rows: Deadline[]; today: string; showClient?: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  return <ul className="divide-y divide-line">
    {rows.map((row) => <li key={row.id} className="flex flex-col justify-between gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="min-w-0">
        {showClient && <Link className="text-xs font-semibold text-action hover:underline" to={TEAM_PATHS.process(row.process_id) + "/prazos"}>{row.process?.client?.full_name ?? t("schedule.open_process")}</Link>}
        <p className="font-semibold break-words">{row.title || t("deadline_type." + row.deadline_type)}</p>
        <p className="mt-1 text-sm text-muted">{format.date(row.due_on)}<span aria-hidden="true"> · </span>{row.person?.full_name || t("schedule.company")}</p>
      </div>
      <DeadlineBadge deadline={row} today={today} />
    </li>)}
  </ul>;
}
export function DeadlineDownload({ document }: { document: NonNullable<Deadline["document"]> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div className="flex flex-col items-start gap-2">
    <Button variant="link" busy={busy} disabled={!!document.purged_at} onClick={async () => {
      setBusy(true); setError(null);
      try { setError(await openDownload("document", document.id)); } catch { setError("network"); } finally { setBusy(false); }
    }}><Icon name="download" className="size-4" />{t("schedule.open_document")}</Button>
    {error && <Alert>{t("errors." + error)}</Alert>}
  </div>;
}
