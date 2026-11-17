// Pagamento do cliente: estado, valores em AED e os dados bancários depois de libertados pela equipa.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, Badge, type BadgeTone, Card, DataList, PageTitle, Spinner } from "../../components/ui";
import { useClientPayments, useClientProcesses, useClientProposals } from "../../lib/clientData";
import { supabase } from "../../lib/supabase";
import { type PaymentStatus, paymentTotals } from "../../lib/team";
import { useFormat } from "../../lib/teamData";

const TONES: Record<PaymentStatus, BadgeTone> = { pending: "warning", partial: "info", paid: "success" };

interface BankDetails {
  beneficiary: string;
  bank_name: string;
  iban: string | null;
  account_number: string | null;
  swift: string | null;
  currency: string;
}

export default function ClientPayment() {
  const { t } = useTranslation();
  const format = useFormat();
  const { current } = useClientProcesses();
  const payments = useClientPayments(current?.id);
  const proposals = useClientProposals(current?.id);
  // A RLS só mostra a conta depois de a equipa a libertar (e com a proposta aceite).
  const bank = useQuery({
    queryKey: ["client-bank", current?.id, current?.bank_details_released_at],
    enabled: !!current?.bank_details_released_at && !!current?.bank_account_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("beneficiary, bank_name, iban, account_number, swift, currency")
        .eq("id", current!.bank_account_id!);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as BankDetails | null;
    },
  });

  const rows = payments.data ?? [];
  const totals = paymentTotals(rows);
  const accepted = (proposals.data ?? []).some((p) => p.status === "accepted");

  return (
    <>
      <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={t("client_payment.title")}>
        {accepted ? t("client_payment.intro") : t("client_payment.before_acceptance")}
      </PageTitle>
      {payments.isPending && current && <Spinner />}
      {payments.isError && <Alert>{t("client_payment.load_error")}</Alert>}
      <div className="flex flex-col gap-6">
        {rows.length > 0 && (
          <Card title={t("client_payment.summary")}>
            <div className="flex flex-col gap-4">
              <DataList
                items={[
                  { label: t("payments.total"), value: format.aed(totals.total) },
                  { label: t("client_payment.paid"), value: format.aed(totals.paid) },
                  { label: t("client_payment.outstanding"), value: format.aed(totals.outstanding) },
                ]}
              />
              <ul className="divide-y divide-line">
                {rows.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold text-primary">{p.description || t("payments.no_description")}</p>
                      <p className="text-sm text-muted">
                        {[
                          format.aed(p.amount_aed),
                          p.due_on ? t("payments.due_on", { date: format.date(p.due_on) }) : null,
                          p.paid_on ? t("payments.paid_on", { date: format.date(p.paid_on) }) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Badge tone={TONES[p.status]}>{t(`client_payment_status.${p.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
        {payments.isSuccess && rows.length === 0 && accepted && <p className="text-muted">{t("client_payment.no_payments")}</p>}

        {accepted && (
          <Card title={t("client_payment.bank_title")}>
            {!current?.bank_details_released_at ? (
              <p className="text-sm text-muted">{t("client_payment.bank_pending")}</p>
            ) : bank.isPending ? (
              <Spinner />
            ) : bank.data ? (
              <div className="flex flex-col gap-4">
                <DataList
                  items={[
                    { label: t("client_payment.beneficiary"), value: bank.data.beneficiary },
                    { label: t("client_payment.bank"), value: bank.data.bank_name },
                    ...(bank.data.iban ? [{ label: "IBAN", value: <span className="font-mono">{bank.data.iban}</span> }] : []),
                    ...(bank.data.account_number
                      ? [{ label: t("client_payment.account_number"), value: <span className="font-mono">{bank.data.account_number}</span> }]
                      : []),
                    ...(bank.data.swift ? [{ label: "SWIFT/BIC", value: <span className="font-mono">{bank.data.swift}</span> }] : []),
                    { label: t("client_payment.currency"), value: bank.data.currency },
                  ]}
                />
                <p className="text-sm text-muted">{t("client_payment.bank_hint")}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">{t("client_payment.bank_pending")}</p>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
