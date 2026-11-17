import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { DeadlineList, ScheduleEmpty, ScheduleStats } from "../../components/ScheduleUI";
import { Alert, Button, Card, PageTitle, Spinner, TextField } from "../../components/ui";
import { addDays, groupWeeks, isActiveDeadline, monthDays, monthStart, shiftMonth } from "../../lib/schedule";
import { useDeadlines } from "../../lib/scheduleData";
import { useFormat, useTeamSettings } from "../../lib/teamData";

export default function Calendar() {
  const { t, i18n } = useTranslation();
  const { today } = useTeamSettings();
  const format = useFormat();
  const query = useDeadlines(undefined, true);
  const [view, setView] = useState<"month" | "weeks">("month");
  const [month, setMonth] = useState(monthStart(today));
  const [selected, setSelected] = useState(today);
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase(i18n.language);
  const rows = (query.data ?? []).filter(isActiveDeadline).filter((row) =>
    [row.title, t("deadline_type." + row.deadline_type), row.person?.full_name, row.process?.client?.full_name].some((text) => text?.toLocaleLowerCase(i18n.language).includes(term)));
  const overdue = rows.filter((row) => row.due_on < today);
  const weeks = groupWeeks(rows.filter((row) => row.due_on >= today && row.due_on <= addDays(today, 89)));
  const selectedRows = rows.filter((row) => row.due_on === selected);
  const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(i18n.language, { ...options, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  function move(amount: number) { const next = shiftMonth(month, amount); setMonth(next); setSelected(next); }
  return <>
    <PageTitle eyebrow={t("auth_layout.eyebrow_team")} title={t("calendar.title")}>{t("calendar.intro")}</PageTitle>
    <div className="flex flex-col gap-6">
      {query.isPending && <Spinner />}{query.isError && <Alert>{t("client_deadlines.load_error")}</Alert>}
      {query.isSuccess && <ScheduleStats rows={rows} today={today} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div role="group" aria-label={t("calendar.view")} className="flex self-start rounded-xl border border-line bg-white p-1">
          {(["month", "weeks"] as const).map((value) => <button key={value} aria-pressed={view === value} onClick={() => setView(value)} className={"rounded-lg px-4 py-2 text-sm font-semibold " + (view === value ? "bg-primary text-white" : "text-muted")}>{t("calendar." + value)}</button>)}
        </div>
        <TextField type="search" label={t("calendar.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-72" />
      </div>
      {query.isSuccess && view === "month" && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(250px,1fr)]">
        <section className="portal-card min-w-0" aria-label={t("calendar.month")}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 sm:p-5">
            <h2 className="text-xl font-light first-letter:uppercase" aria-live="polite">{dateLabel(month, { month: "long", year: "numeric" })}</h2>
            <div className="flex items-center gap-1">
              <Button variant="secondary" aria-label={t("calendar.previous")} onClick={() => move(-1)} className="px-2"><Icon name="arrow" className="size-4 rotate-180" /></Button>
              <Button variant="link" className="mx-3" onClick={() => { setMonth(monthStart(today)); setSelected(today); }}>{t("schedule.today")}</Button>
              <Button variant="secondary" aria-label={t("calendar.next")} onClick={() => move(1)} className="px-2"><Icon name="arrow" className="size-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-line text-center">
            {Array.from({ length: 7 }, (_, i) => <span key={i} aria-label={dateLabel(addDays("2026-11-16", i), { weekday: "long" })} className="py-3 text-[.65rem] font-semibold tracking-wider text-muted uppercase">{dateLabel(addDays("2026-11-16", i), { weekday: "short" }).slice(0, 3)}</span>)}
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-b-2xl">
            {monthDays(month).map((date) => {
              const items = rows.filter((row) => row.due_on === date);
              const inMonth = date.startsWith(month.slice(0, 7));
              return <button key={date} aria-pressed={selected === date} aria-current={date === today ? "date" : undefined}
                aria-label={t("calendar.day_label", { date: format.date(date), count: items.length })}
                onClick={() => setSelected(date)} className={"flex min-h-20 min-w-0 flex-col items-start border-r border-b border-line/50 p-1.5 text-left transition-colors sm:min-h-24 sm:p-2 " + (selected === date ? "bg-primary text-white" : inMonth ? "bg-white hover:bg-background" : "bg-background/60 text-muted")}>
                <span className={"inline-flex size-6 items-center justify-center rounded-full text-sm " + (date === today && selected !== date ? "bg-primary text-white" : "")}>{Number(date.slice(-2))}</span>
                {items.length > 0 && <>
                  <span className="mt-1 hidden space-y-1 sm:block">{items.slice(0, 2).map((item) => <span key={item.id} className="block truncate text-[.65rem] leading-tight">{item.process?.client?.full_name || item.title || t("deadline_type." + item.deadline_type)}</span>)}</span>
                  <span className="mt-2 block text-xs font-semibold tabular-nums">{items.length}<span className="sr-only"> {t("calendar.deadlines")}</span></span>
                </>}
              </button>;
            })}
          </div>
        </section>
        <Card title={t("calendar.selected", { date: format.date(selected) })}>
          {selectedRows.length ? <DeadlineList rows={selectedRows} today={today} showClient /> : <ScheduleEmpty title={t("calendar.no_day")} body={t("calendar.select_hint")} />}
        </Card>
      </div>}
      {query.isSuccess && view === "weeks" && <div className="flex flex-col gap-5">
        <p className="text-sm text-muted">{t("calendar.range", { start: format.date(today), end: format.date(addDays(today, 89)) })}</p>
        {!weeks.length && <Card><ScheduleEmpty title={t("calendar.no_upcoming")} /></Card>}
        {weeks.map((week) => <Card key={week.start} title={t("calendar.week_label", { start: format.date(week.start), end: format.date(addDays(week.start, 6)) })}>
          <DeadlineList rows={week.items} today={today} showClient />
        </Card>)}
      </div>}
      {overdue.length > 0 && <Card title={t("calendar.overdue_title")}><DeadlineList rows={overdue} today={today} showClient /></Card>}
      <p className="text-xs text-muted">{t("calendar.footer")}</p>
    </div>
  </>;
}
