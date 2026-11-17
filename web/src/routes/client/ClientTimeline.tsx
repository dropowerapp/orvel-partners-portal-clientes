// Percurso do cliente: passos agrupados pelas fases do documento da Orvel, com prazos indicativos.
import { useTranslation } from "react-i18next";
import { Alert, Badge, PageTitle, Spinner } from "../../components/ui";
import { localized, phaseProgress } from "../../lib/client";
import { useClientProcesses, useClientSteps } from "../../lib/clientData";
import { useFormat } from "../../lib/teamData";

export default function ClientTimeline() {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const { current } = useClientProcesses();
  const steps = useClientSteps(current?.id);
  const { phases, percent } = phaseProgress(steps.data ?? []);

  return (
    <>
      <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={t("client_timeline.title")}>
        {t("client_timeline.intro")}
      </PageTitle>
      {steps.isPending && current && <Spinner />}
      {steps.isError && <Alert>{t("client_timeline.load_error")}</Alert>}
      {steps.isSuccess && phases.length === 0 && <p className="text-muted">{t("client_timeline.empty")}</p>}
      {phases.length > 0 && <p className="mb-6 text-sm font-semibold text-primary">{t("client_timeline.percent", { percent })}</p>}
      <ol className="flex flex-col gap-6">
        {phases.map((phase, index) => (
          <li key={phase.phase} className="portal-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-start gap-4">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                    phase.state === "current" ? "border-primary bg-primary text-white" : "border-line text-primary"
                  }`}
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="text-lg font-light text-primary">{t(`phases.${phase.phase}.title`)}</h2>
                  <p className="text-sm text-muted">{t(`phases.${phase.phase}.hint`)}</p>
                </div>
              </div>
              <Badge tone={phase.state === "done" ? "success" : phase.state === "current" ? "info" : "neutral"}>
                {t(`client_timeline.state.${phase.state}`)}
              </Badge>
            </div>
            <ul className="divide-y divide-line">
              {phase.steps.map((step) => (
                <li key={step.id} className="flex gap-3 px-5 py-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                      step.status === "done" ? "bg-green-600" : step.status === "in_progress" ? "bg-action" : "bg-silver"
                    }`}
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${step.status === "done" ? "text-primary" : "font-semibold text-primary"}`}>
                      {localized(step.title, i18n.language)}
                      <span className="sr-only"> · {t(`step_status.${step.status}`)}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {[
                        step.planned_on ? t("client_timeline.planned_on", { date: format.date(step.planned_on) }) : null,
                        step.done_on ? t("client_timeline.done_on", { date: format.date(step.done_on) }) : null,
                      ].filter(Boolean).join(" · ") || t(`step_status.${step.status}`)}
                    </p>
                    {step.client_note && <p className="mt-2 border-l-2 border-line pl-3 text-sm leading-relaxed whitespace-pre-wrap text-muted">{step.client_note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {phases.length > 0 && <p className="mt-6 text-xs text-muted">{t("client_timeline.disclaimer")}</p>}
    </>
  );
}
