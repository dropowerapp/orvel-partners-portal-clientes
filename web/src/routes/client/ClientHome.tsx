// Início da área de cliente: resumo de tudo (o que falta, percurso por fases, pagamento, prazos e
// contacto), com atalhos para cada página.
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Alert, Badge, Card, PageTitle, Spinner } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../lib/AuthProvider";
import { daysUntil, localized, pendingForClient, phaseProgress, upcomingDeadlines } from "../../lib/client";
import {
  useClientDeadlines,
  useClientPayments,
  useClientProcesses,
  useClientProposals,
  useClientRequests,
  useClientSteps,
} from "../../lib/clientData";
import { useOrg } from "../../lib/OrgProvider";
import { supabase } from "../../lib/supabase";
import { paymentTotals, todayIn } from "../../lib/team";
import { useFormat } from "../../lib/teamData";
import { CLIENT_PATHS } from "./ClientLayout";
import { ContactButtons } from "./ClientPages";

const PENDING_LINKS = {
  accept_proposal: CLIENT_PATHS.proposal,
  pay: CLIENT_PATHS.payment,
  fix_documents: CLIENT_PATHS.documents,
  send_documents: CLIENT_PATHS.documents,
  company_names: CLIENT_PATHS.details,
} as const;

export default function ClientHome() {
  const { t, i18n } = useTranslation();
  const { context } = useAuth();
  const format = useFormat();
  const today = todayIn("Asia/Dubai");
  const { query: processesQuery, current } = useClientProcesses();
  const clientQuery = useQuery({
    queryKey: ["my-client", context?.client_id],
    enabled: !!context?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("full_name").eq("id", context!.client_id!).single();
      if (error) throw error;
      return data as { full_name: string };
    },
  });
  const proposals = useClientProposals(current?.id);
  const payments = useClientPayments(current?.id);
  const requests = useClientRequests(current?.id);
  const steps = useClientSteps(current?.id);
  const deadlines = useClientDeadlines(current?.id);

  const firstName = clientQuery.data?.full_name.split(" ")[0];
  const title = firstName ? t("client_home.title", { name: firstName }) : t("client_home.title_anonymous");

  if (processesQuery.isPending) return <Spinner />;
  if (processesQuery.isError) return <Alert>{t("client_home.load_error")}</Alert>;
  if (!current) {
    return (
      <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={title}>
        {t("client_home.no_process")}
      </PageTitle>
    );
  }

  const pending = pendingForClient({
    process: current,
    proposals: proposals.data ?? [],
    payments: payments.data ?? [],
    requests: requests.data ?? [],
    today,
  });
  const progress = phaseProgress(steps.data ?? []);
  const totals = paymentTotals(payments.data ?? []);
  const nextDeadlines = upcomingDeadlines(deadlines.data ?? []);
  const loading = proposals.isPending || payments.isPending || requests.isPending;

  return (
    <>
      <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={title}>
        {[current.plan_name, t(`client_status.${current.status}`)].filter(Boolean).join(" · ")}
      </PageTitle>

      <section className="mb-8 flex flex-col gap-7 rounded-2xl bg-primary px-6 py-7 text-white sm:px-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-xl">
          <p className="mb-3 text-xs tracking-[0.18em] text-silver uppercase">{t("client_home.overview")}</p>
          <h2 className="text-2xl font-light sm:text-3xl">{t(current.completed_at ? "client_home.project_complete" : "client_home.project_heading")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-silver">{t("client_home.project_intro")}</p>
          <Link to={CLIENT_PATHS.timeline} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white hover:underline">{t("client_home.follow_progress")}<Icon name="arrow" className="size-4" /></Link>
        </div>
        <div className="min-w-44 border-t border-white/15 pt-5 xl:border-t-0 xl:border-l xl:pl-7 xl:pt-0">
          <p className="text-xs text-silver">{t("client_home.progress")}</p>
          <p className="my-2 text-4xl font-light tabular-nums">{steps.isPending || steps.isError ? "—" : progress.percent + "%"}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-silver" style={{ width: (steps.isPending || steps.isError ? 0 : progress.percent) + "%" }} /></div>
        </div>
      </section>
      {(proposals.isError || payments.isError || requests.isError || steps.isError || deadlines.isError) && <div className="mb-6"><Alert>{t("client_home.load_error")}</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Card title={t("client_home.pending_title")}>
            {loading ? (
              <Spinner />
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted">{t(current.completed_at ? "client_home.pending_done" : "client_home.pending_none")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pending.map((item) => (
                  <li key={item.kind}>
                    <Link
                      to={PENDING_LINKS[item.kind]}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-4 transition-colors hover:bg-background"
                    >
                      <span className="text-sm font-semibold text-primary">{t(`client_home.pending.${item.kind}`, { count: item.count ?? 0 })}</span>
                      <span aria-hidden="true" className="text-action">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={t("client_home.timeline_title")}
            actions={
              <Link to={CLIENT_PATHS.timeline} className="text-sm font-semibold text-action hover:underline">
                {t("client_home.see_all")}
              </Link>
            }
          >
            {steps.isPending ? (
              <Spinner />
            ) : progress.phases.length === 0 ? (
              <p className="text-sm text-muted">{t("client_timeline.empty")}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-muted">
                    <span>{t("client_home.progress")}</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("client_home.progress")}>
                    <div className="h-full rounded-full bg-action" style={{ width: `${progress.percent}%` }} />
                  </div>
                </div>
                <ol className="flex flex-col gap-2">
                  {progress.phases.map((phase) => (
                    <li key={phase.phase} className="flex items-center justify-between gap-3 text-sm">
                      <span className={phase.state === "upcoming" ? "text-muted" : "font-semibold text-primary"}>{t(`phases.${phase.phase}.title`)}</span>
                      <Badge tone={phase.state === "done" ? "success" : phase.state === "current" ? "info" : "neutral"}>
                        {phase.state === "done" ? t("client_home.phase_done") : `${phase.done}/${phase.total}`}
                      </Badge>
                    </li>
                  ))}
                </ol>
                {progress.current && (
                  <p className="rounded-md bg-background px-3 py-2 text-sm">
                    <span className="font-semibold text-primary">{t("client_home.current_step")}</span>{" "}
                    {localized(progress.current.title, i18n.language)}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {(payments.data ?? []).length > 0 && (
            <SummaryCard title={t("client_home.payment_title")} to={CLIENT_PATHS.payment} link={t("client_home.see_payment")}>
              <p className="text-2xl font-light text-primary">{format.aed(totals.outstanding)}</p>
              <p className="text-sm text-muted">{t("client_home.payment_outstanding", { paid: format.aed(totals.paid), total: format.aed(totals.total) })}</p>
            </SummaryCard>
          )}
          {nextDeadlines.length > 0 && (
            <SummaryCard title={t("client_home.deadlines_title")} to={CLIENT_PATHS.deadlines} link={t("client_home.see_all")}>
              <ul className="flex flex-col gap-2 text-sm">
                {nextDeadlines.map((d) => (
                  <li key={d.id} className="flex justify-between gap-3">
                    <span className="text-primary">{d.title || t(`deadline_type.${d.deadline_type}`)}</span>
                    <span className={daysUntil(d.due_on, today) <= 30 ? "font-semibold text-amber-800" : "text-muted"}>{format.date(d.due_on)}</span>
                  </li>
                ))}
              </ul>
            </SummaryCard>
          )}
          <ContactCard />
        </div>
      </div>
      {processesQuery.isError && <Alert>{t("client_home.load_error")}</Alert>}
    </>
  );
}

function SummaryCard({ title, to, link, children }: { title: string; to: string; link: string; children: ReactNode }) {
  return (
    <Card
      title={title}
      actions={
        <Link to={to} className="text-sm font-semibold text-action hover:underline">
          {link}
        </Link>
      }
    >
      {children}
    </Card>
  );
}

function ContactCard() {
  const { t } = useTranslation();
  const org = useOrg();
  return (
    <Card title={t("client_home.contact_title")}>
      <p className="mb-3 text-sm text-muted">{t("client_home.contact_body", { org: org.name })}</p>
      <ContactButtons />
    </Card>
  );
}
