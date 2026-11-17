import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { Icon } from "../../../components/Icon";
import { Alert, Badge, Button, Card, SelectField, Spinner, TextAreaField, TextField } from "../../../components/ui";
import { PHASES, type Phase, localized, phaseProgress } from "../../../lib/client";
import { errorKey } from "../../../lib/errors";
import type { TeamStep } from "../../../lib/schedule";
import { useRefreshSchedule, useTeamSteps } from "../../../lib/scheduleData";
import { supabase } from "../../../lib/supabase";
import { useFormat, useTeamSettings } from "../../../lib/teamData";
import { useProcess } from "./ProcessLayout";

export default function ProcessTimeline() {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const { process, closed } = useProcess();
  const [editing, setEditing] = useState<TeamStep | "new" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const steps = useTeamSteps(process.id);
  const refresh = useRefreshSchedule(process.id);
  const { phases, percent } = phaseProgress(steps.data ?? []);
  const remove = useMutation({ mutationFn: async (step: TeamStep) => {
    const { error } = await supabase.rpc("remove_timeline_step", { p_step_id: step.id, p_expected_updated_at: step.updated_at });
    if (error) throw error;
  }, onSuccess: async () => { setMessage({ tone: "success", text: t("team_timeline.removed") }); await refresh(); },
  onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }) });
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <p className="max-w-prose text-sm leading-relaxed text-muted">{t("team_timeline.intro", { percent })}</p>
      {!closed && <Button onClick={() => { setEditing("new"); setMessage(null); }} disabled={!!editing || remove.isPending}><Icon name="plus" className="size-4" />{t("team_timeline.add")}</Button>}
    </div>
    {message && <Alert tone={message.tone}>{message.text}</Alert>}
    {steps.isPending && <Spinner />}{steps.isError && <Alert>{t("client_timeline.load_error")}</Alert>}
    {steps.isSuccess && <div className="portal-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3"><span className="text-sm font-semibold">{t("team_timeline.progress")}</span><span className="text-2xl font-light">{percent}%</span></div>
      <div role="progressbar" aria-label={t("team_timeline.progress")} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary-deep" style={{ width: `${percent}%` }} /></div>
    </div>}
    {editing && <Card title={t(editing === "new" ? "team_timeline.add" : "team_timeline.edit")}>
      <StepForm key={editing === "new" ? "new" : editing.id} processId={process.id} step={editing === "new" ? undefined : editing}
        onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); setMessage({ tone: "success", text: t("team_timeline.saved_generic") }); await refresh(); }} />
    </Card>}
    {steps.isSuccess && !phases.length && <p className="text-muted">{t("client_timeline.empty")}</p>}
    {phases.map((phase, index) => <Card key={phase.phase} title={<span className="flex items-center gap-3"><span className="text-xs font-normal tracking-widest text-muted">{String(index + 1).padStart(2, "0")}</span>{t(`phases.${phase.phase}.title`)}</span>}
      actions={<Badge tone={phase.state === "done" ? "success" : phase.state === "current" ? "info" : "neutral"}>{phase.done}/{phase.total}</Badge>}>
      <ul className="divide-y divide-line">
        {phase.steps.map((raw) => { const step = raw as TeamStep; return <li key={step.id} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><h3 className="font-semibold break-words">{localized(step.title, i18n.language)}</h3>
              <p className="mt-1 text-xs text-muted">{[
                step.planned_on ? t("client_timeline.planned_on", { date: format.date(step.planned_on) }) : null,
                step.done_on ? t("client_timeline.done_on", { date: format.date(step.done_on) }) : null,
              ].filter(Boolean).join(" · ")}</p>
              {step.client_note && <p className="mt-3 border-l-2 border-line pl-3 text-sm leading-relaxed whitespace-pre-wrap text-muted">{step.client_note}</p>}
            </div>
            <div className="flex flex-wrap gap-2"><Badge tone={step.status === "done" ? "success" : step.status === "in_progress" ? "info" : "neutral"}>{t(`step_status.${step.status}`)}</Badge>
              {step.auto_event && <Badge>{t("team_timeline.automatic")}</Badge>}</div>
          </div>
          {!closed && !step.auto_event && <div className="flex flex-wrap items-center gap-4">
            <Button variant="secondary" disabled={!!editing || remove.isPending} onClick={() => { setEditing(step); setMessage(null); }}>{t("actions.edit")}</Button>
            <ConfirmButton label={t("actions.remove")} confirmLabel={t("actions.remove")} question={t("team_timeline.remove_question", { title: localized(step.title, i18n.language) })}
              disabled={!!editing} busy={remove.isPending} variant="link" onConfirm={() => remove.mutate(step)} />
          </div>}
        </li>; })}
      </ul>
    </Card>)}
  </div>;
}

interface StepValues { title: string; phase: Phase; status: TeamStep["status"]; planned_on: string; done_on: string; client_note: string }
export function StepForm({ processId, step, onCancel, onSaved }: { processId: string; step?: TeamStep; onCancel: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const { today } = useTeamSettings();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<StepValues>({ defaultValues: {
    title: localized(step?.title, "pt-PT"), phase: step?.phase ?? "incorporation", status: step?.status ?? "todo",
    planned_on: step?.planned_on ?? "", done_on: step?.done_on ?? "", client_note: step?.client_note ?? "",
  } });
  const status = watch("status");
  const save = useMutation({ mutationFn: async (v: StepValues) => {
    const { error } = await supabase.rpc("save_timeline_step", {
      p_process_id: processId, p_step_id: step?.id ?? null, p_expected_updated_at: step?.updated_at ?? null,
      p_title: v.title.trim(), p_phase: v.phase, p_status: v.status, p_planned_on: v.planned_on || null,
      p_done_on: v.status === "done" ? v.done_on || today : null, p_note: v.client_note.trim() || null,
    });
    if (error) throw error;
  }, onSuccess: onSaved, onError: (e) => setError(t(errorKey(e))) });
  return <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((values) => { setError(null); save.mutate(values); })}>
    {error && <Alert>{error}</Alert>}
    <TextField label={t("team_timeline.title_label")} maxLength={200} error={errors.title?.message} {...register("title", { validate: (value) => !!value.trim() || t("validation.required") })} />
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label={t("team_timeline.phase")} options={PHASES.map((value) => ({ value, label: t(`phases.${value}.title`) }))} {...register("phase")} />
      <SelectField label={t("schedule.status")} options={["todo", "in_progress", "done"].map((value) => ({ value, label: t("step_status." + value) }))} {...register("status")} />
      <TextField label={t("team_timeline.planned_on")} type="date" {...register("planned_on")} />
      {status === "done" && <TextField label={t("team_timeline.done_on")} type="date" max={today} error={errors.done_on?.message} hint={t("payments.paid_date_hint")} {...register("done_on", { validate: (value) => status !== "done" || !value || value <= today || t("errors.timeline_future_completion") })} />}
    </div>
    <TextAreaField label={t("team_timeline.client_note")} maxLength={2000} placeholder={t("team_timeline.client_note_placeholder")} {...register("client_note")} />
    <p className="text-xs text-muted">{t("team_timeline.client_note_hint")}</p>
    <div className="flex gap-3"><Button type="submit" busy={save.isPending}>{t("actions.save")}</Button><Button type="button" variant="link" disabled={save.isPending} onClick={onCancel}>{t("actions.cancel")}</Button></div>
  </form>;
}
