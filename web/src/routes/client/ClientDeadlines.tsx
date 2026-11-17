// Prazos e renovações do cliente (licença, contrato de escritório, Establishment Card, vistos…).
import { useTranslation } from "react-i18next";
import { Alert, Badge, PageTitle, Spinner } from "../../components/ui";
import { daysUntil } from "../../lib/client";
import { useClientDeadlines, useClientProcesses } from "../../lib/clientData";
import { todayIn } from "../../lib/team";
import { useFormat } from "../../lib/teamData";

export default function ClientDeadlines() {
  const { t } = useTranslation();
  const format = useFormat();
  const today = todayIn("Asia/Dubai");
  const { current } = useClientProcesses();
  const deadlines = useClientDeadlines(current?.id);
  const rows = (deadlines.data ?? []).filter((d) => d.status !== "dismissed");

  return (
    <>
      <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={t("client_deadlines.title")}>
        {t("client_deadlines.intro")}
      </PageTitle>
      {deadlines.isPending && current && <Spinner />}
      {deadlines.isError && <Alert>{t("client_deadlines.load_error")}</Alert>}
      {deadlines.isSuccess && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-white px-5 py-8 text-center text-muted">{t("client_deadlines.empty")}</div>
      )}
      {rows.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
          {rows.map((d) => {
            const days = daysUntil(d.due_on, today);
            const tone = d.status === "renewed" ? "success" : days < 0 ? "danger" : days <= 30 ? "warning" : "neutral";
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold text-primary">{d.title || t(`deadline_type.${d.deadline_type}`)}</p>
                  <p className="text-sm text-muted">{t("client_deadlines.due_on", { date: format.date(d.due_on) })}</p>
                </div>
                <Badge tone={tone}>
                  {d.status === "renewed"
                    ? t("client_deadlines.renewed")
                    : d.status === "renewing"
                    ? t("client_deadlines.renewing")
                    : days < 0
                    ? t("client_deadlines.expired")
                    : t("client_deadlines.in_days", { days })}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted">{t("client_deadlines.disclaimer")}</p>
    </>
  );
}
