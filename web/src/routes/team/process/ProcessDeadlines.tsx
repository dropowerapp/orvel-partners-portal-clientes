import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Icon } from "../../../components/Icon";
import { DeadlineBadge, DeadlineDownload, ScheduleEmpty, ScheduleStats } from "../../../components/ScheduleUI";
import { Alert, Badge, Button, Card, SelectField, Spinner, TextField } from "../../../components/ui";
import { useDocumentOptions } from "../../../lib/documentData";
import { errorKey } from "../../../lib/errors";
import { DEADLINE_TYPES, type Deadline, type DeadlineType, isActiveDeadline } from "../../../lib/schedule";
import { useDeadlines, useRefreshSchedule } from "../../../lib/scheduleData";
import { supabase } from "../../../lib/supabase";
import { TEAM_PATHS, useFormat, useTeamSettings } from "../../../lib/teamData";
import { useProcess } from "./ProcessLayout";

export default function ProcessDeadlines() {
  const { t } = useTranslation();
  const { process } = useProcess();
  const { today } = useTeamSettings();
  const format = useFormat();
  const query = useDeadlines(process.id);
  const refresh = useRefreshSchedule(process.id);
  const [history, setHistory] = useState(false);
  const [editing, setEditing] = useState<Deadline | "new" | null>(null);
  const [saved, setSaved] = useState(false);
  const rows = (query.data ?? []).filter((d) => history ? !isActiveDeadline(d) : isActiveDeadline(d));
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <p className="max-w-prose text-sm leading-relaxed text-muted">{t("schedule.process_intro")}</p>
      <Button onClick={() => { setEditing("new"); setSaved(false); }} disabled={!!editing}><Icon name="plus" className="size-4" />{t("schedule.add")}</Button>
    </div>
    {saved && <Alert tone="success">{t("schedule.saved")}</Alert>}
    {query.isPending && <Spinner />}
    {query.isError && <Alert>{t("client_deadlines.load_error")}</Alert>}
    {query.isSuccess && <ScheduleStats rows={query.data} today={today} />}
    {editing && <Card title={t(editing === "new" ? "schedule.add" : "schedule.edit")}>
      <DeadlineForm key={editing === "new" ? "new" : editing.id} processId={process.id} deadline={editing === "new" ? undefined : editing}
        onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); setSaved(true); await refresh(); }} />
    </Card>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label={t("schedule.filter")} className="inline-flex rounded-xl border border-line bg-white p-1">
        {[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={history === value} onClick={() => setHistory(value)} className={"rounded-lg px-4 py-2 text-sm font-semibold " + (history === value ? "bg-primary text-white" : "text-muted")}>{t(value ? "schedule.history" : "schedule.active")}</button>)}
      </div>
      <Link className="text-sm font-semibold text-action hover:underline" to={TEAM_PATHS.calendar}>{t("schedule.view_calendar")}</Link>
    </div>
    {query.isSuccess && <Card>
      {!rows.length ? <ScheduleEmpty title={t(history ? "schedule.no_history" : "schedule.empty")} body={t("schedule.empty_body")} /> : <ul className="divide-y divide-line">
        {rows.map((row) => <li key={row.id} className="py-5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{row.title || t("deadline_type." + row.deadline_type)}</h2>
              <p className="mt-1 text-sm text-muted">{format.date(row.due_on)}<span aria-hidden="true"> · </span>{row.person?.full_name || t("schedule.company")}</p>
            </div>
            <DeadlineBadge deadline={row} today={today} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4"><Badge>{t(row.document_id ? "schedule.from_document" : "schedule.manual")}</Badge>
              {row.document && <DeadlineDownload document={row.document} />}
            </div>
            {!(row.document_id && row.status === "renewed") && <Button variant="secondary" disabled={!!editing} onClick={() => { setEditing(row); setSaved(false); }}>{t("actions.edit")}</Button>}
          </div>
        </li>)}
      </ul>}
    </Card>}
  </div>;
}

interface DeadlineValues { title: string; type: DeadlineType; person: string; due: string; status: Deadline["status"] }
export function DeadlineForm({ processId, deadline, onCancel, onSaved }: { processId: string; deadline?: Deadline; onCancel: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const options = useDocumentOptions(processId);
  const linked = !!deadline?.document_id;
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<DeadlineValues>({ defaultValues: {
    title: deadline?.title ?? "", type: (deadline?.deadline_type ?? "other") as DeadlineType,
    person: deadline?.person_id ?? "", due: deadline?.due_on ?? "", status: deadline?.status ?? "open",
  } });
  const type = watch("type");
  const save = useMutation({ mutationFn: async (v: DeadlineValues) => {
    const { error } = await supabase.rpc("save_deadline", {
      p_process_id: processId, p_type: linked ? deadline!.deadline_type : v.type,
      p_due_on: linked ? deadline!.due_on : v.due, p_title: linked ? deadline!.title : v.title.trim() || null,
      p_person_id: linked ? deadline!.person_id : v.person || null, p_status: v.status,
      p_deadline_id: deadline?.id ?? null, p_expected_updated_at: deadline?.updated_at ?? null,
    });
    if (error) throw error;
  }, onSuccess: onSaved, onError: (e) => setError(t(errorKey(e))) });
  return <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((values) => { setError(null); save.mutate(values); })}>
    {error && <Alert>{error}</Alert>}
    {linked ? <Alert tone="info">{t("schedule.linked_hint")}</Alert> : <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t("schedule.type")} options={DEADLINE_TYPES.map((value) => ({ value, label: t("deadline_type." + value) }))} {...register("type")} />
        <TextField label={t("schedule.due_on")} type="date" error={errors.due?.message} {...register("due", { required: t("validation.required") })} />
      </div>
      <TextField label={t("schedule.title_label")} maxLength={200} error={errors.title?.message} {...register("title", { validate: (value) => type !== "other" || !!value.trim() || t("validation.required") })} />
      {options.isError && <Alert>{t("schedule.people_error")}</Alert>}
      <SelectField label={t("schedule.person")} disabled={options.isPending} options={[{ value: "", label: t("schedule.company") }, ...(options.data?.people ?? []).map((p) => ({ value: p.id, label: p.full_name }))]} {...register("person")} />
    </>}
    <SelectField label={t("schedule.status")} options={(linked ? ["open", "renewing", "dismissed"] : ["open", "renewing", "renewed", "dismissed"]).map((value) => ({ value, label: t("deadline_status." + value) }))} {...register("status")} />
    <p className="text-xs leading-relaxed text-muted">{t("schedule.client_visible_hint")}</p>
    <div className="flex gap-3"><Button type="submit" busy={save.isPending} disabled={!linked && !options.isSuccess}>{t("actions.save")}</Button>
      <Button type="button" variant="link" disabled={save.isPending} onClick={onCancel}>{t("actions.cancel")}</Button></div>
  </form>;
}
