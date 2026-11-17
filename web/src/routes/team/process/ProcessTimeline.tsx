// Ficha · Percurso: passos por fase, com estado, datas e nota para o cliente. Os passos automáticos
// (proposta aceite, pagamento, documentos, conclusão) avançam sozinhos e não se editam aqui.
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, Badge, Button, Card, SelectField, Spinner, TextAreaField, TextField } from "../../../components/ui";
import { type ClientStep, localized, phaseProgress } from "../../../lib/client";
import { errorKey } from "../../../lib/errors";
import { supabase } from "../../../lib/supabase";
import { useFormat, useTeamSettings } from "../../../lib/teamData";
import { useProcess } from "./ProcessLayout";

type TeamStep = ClientStep & { auto_event: string | null };

export default function ProcessTimeline() {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const { process, closed } = useProcess();
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const steps = useQuery({
    queryKey: ["team-steps", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timeline_steps")
        .select("id, position, phase, title, status, planned_on, done_on, client_note, auto_event")
        .eq("process_id", process.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as TeamStep[];
    },
  });
  const { phases, percent } = phaseProgress(steps.data ?? []);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-sm text-muted">{t("team_timeline.intro", { percent })}</p>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {steps.isPending && <Spinner />}
      {steps.isError && <Alert>{t("client_timeline.load_error")}</Alert>}
      {phases.map((phase) => (
        <Card
          key={phase.phase}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {t(`phases.${phase.phase}.title`)}
              <Badge tone={phase.state === "done" ? "success" : phase.state === "current" ? "info" : "neutral"}>{`${phase.done}/${phase.total}`}</Badge>
            </span>
          }
        >
          <ul className="divide-y divide-line">
            {phase.steps.map((raw) => {
              const step = raw as TeamStep;
              if (editing === step.id) {
                return (
                  <li key={step.id} className="py-3">
                    <StepForm
                      step={step}
                      onDone={async (text) => {
                        setEditing(null);
                        if (text) setMessage({ tone: "success", text });
                        await steps.refetch();
                      }}
                    />
                  </li>
                );
              }
              return (
                <li key={step.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
                      {localized(step.title, i18n.language)}
                      <Badge tone={step.status === "done" ? "success" : step.status === "in_progress" ? "info" : "neutral"}>
                        {t(`step_status.${step.status}`)}
                      </Badge>
                      {step.auto_event && <Badge>{t("team_timeline.automatic")}</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      {[
                        step.planned_on ? t("client_timeline.planned_on", { date: format.date(step.planned_on) }) : null,
                        step.done_on ? t("client_timeline.done_on", { date: format.date(step.done_on) }) : null,
                        step.client_note ? t("team_timeline.has_note") : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {!closed && !step.auto_event && editing === null && (
                    <Button type="button" variant="secondary" onClick={() => setEditing(step.id)}>
                      {t("actions.edit")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

interface StepValues {
  status: TeamStep["status"];
  planned_on: string;
  done_on: string;
  client_note: string;
}

function StepForm({ step, onDone }: { step: TeamStep; onDone: (message: string | null) => void }) {
  const { t, i18n } = useTranslation();
  const { today } = useTeamSettings();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch } = useForm<StepValues>({
    defaultValues: {
      status: step.status,
      planned_on: step.planned_on ?? "",
      done_on: step.done_on ?? "",
      client_note: step.client_note ?? "",
    },
  });
  const status = watch("status");
  const save = useMutation({
    mutationFn: async (v: StepValues) => {
      const { error } = await supabase
        .from("timeline_steps")
        .update({
          status: v.status,
          planned_on: v.planned_on || null,
          done_on: v.status === "done" ? v.done_on || today : null,
          client_note: v.client_note.trim() || null,
        })
        .eq("id", step.id);
      if (error) throw error;
    },
    onSuccess: () => onDone(t("team_timeline.saved", { step: localized(step.title, i18n.language) })),
    onError: (e) => setError(t(errorKey(e))),
  });
  const options = (["todo", "in_progress", "done"] as const).map((s) => ({ value: s, label: t(`step_status.${s}`) }));
  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-md border border-line bg-background p-4"
      onSubmit={handleSubmit((v) => {
        setError(null);
        save.mutate(v);
      })}
    >
      <p className="text-sm font-semibold text-primary">{localized(step.title, i18n.language)}</p>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField label={t("payments.status")} options={options} {...register("status")} />
        <TextField label={t("team_timeline.planned_on")} type="date" {...register("planned_on")} />
        {status === "done" && <TextField label={t("team_timeline.done_on")} type="date" hint={t("payments.paid_date_hint")} {...register("done_on")} />}
      </div>
      <TextAreaField label={t("team_timeline.client_note")} placeholder={t("team_timeline.client_note_placeholder")} {...register("client_note")} />
      <p className="text-xs text-muted">{t("team_timeline.client_note_hint")}</p>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending}>
          {t("actions.save")}
        </Button>
        <Button type="button" variant="link" onClick={() => onDone(null)}>
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
