// Proposta do cliente: PDF (URL assinado), escolha do plano, texto de aceitação e comprovativo.
// A aceitação é feita pela função accept_proposal (regista data, hora, IP e utilizador).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Alert, Badge, Button, Card, CheckboxField, DataList, PageTitle, Spinner } from "../../components/ui";
import type { ClientProposal as Proposal } from "../../lib/client";
import { useClientProcesses, useClientProposals } from "../../lib/clientData";
import { openDownload } from "../../lib/download";
import { errorKey } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import { todayIn } from "../../lib/team";
import { useFormat } from "../../lib/teamData";
import { CLIENT_PATHS } from "./ClientLayout";

export default function ClientProposal() {
  const { t } = useTranslation();
  const { current } = useClientProcesses();
  const proposals = useClientProposals(current?.id);
  const rows = proposals.data ?? [];
  const accepted = rows.find((p) => p.status === "accepted");
  const open = accepted ? undefined : rows.find((p) => p.status === "sent");
  const history = rows.filter((p) => p !== accepted && p !== open);

  return (
    <>
      <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={t("client_proposal.title")}>
        {accepted ? t("client_proposal.intro_accepted") : open ? t("client_proposal.intro_open") : t("client_proposal.intro_none")}
      </PageTitle>
      {proposals.isPending && current && <Spinner />}
      {proposals.isError && <Alert>{t("client_proposal.load_error")}</Alert>}
      <div className="flex flex-col gap-6">
        {accepted && <AcceptedProposal proposal={accepted} />}
        {open && <OpenProposal key={open.id} proposal={open} closed={!!current?.completed_at || !!current?.cancelled_at} />}
        {history.length > 0 && (
          <Card title={t("client_proposal.history")}>
            <ul className="divide-y divide-line">
              {history.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="font-semibold text-primary">{p.reference}</span>
                  <Badge>{t(`proposal_status.${p.status}`)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function PdfButton({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!proposal.pdf_path) return null;
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          type="button"
          variant="secondary"
          busy={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            const code = await openDownload("proposal", proposal.id);
            setBusy(false);
            if (code) setError(t(`errors.${code}`, { defaultValue: t("errors.generic") }));
          }}
        >
          {t("client_proposal.open_pdf")}
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

function OpenProposal({ proposal, closed }: { proposal: Proposal; closed: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<string | null>(proposal.plans.length === 1 ? proposal.plans[0].name : null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = !!proposal.valid_until && proposal.valid_until < todayIn("Asia/Dubai");

  const text = useQuery({
    queryKey: ["acceptance-text", proposal.id, plan],
    enabled: !!plan && !expired && !closed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_acceptance_text", { p_proposal_id: proposal.id, p_plan_name: plan });
      if (error) throw error;
      return data as string;
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("accept_proposal", {
        p_proposal_id: proposal.id,
        p_plan_name: plan,
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client"] }),
        queryClient.invalidateQueries({ queryKey: ["client-processes"] }),
      ]);
      navigate(CLIENT_PATHS.home, { replace: true });
    },
    onError: (e) => setError(t(errorKey(e))),
  });

  return (
    <Card title={proposal.reference}>
      <div className="flex flex-col gap-5">
        <DataList
          items={[
            { label: t("client_proposal.sent_at"), value: format.date(proposal.sent_at) },
            { label: t("proposals.valid_until"), value: format.date(proposal.valid_until) },
          ]}
        />
        <PdfButton proposal={proposal} />
        {closed ? (
          <Alert tone="info">{t("client_proposal.closed")}</Alert>
        ) : expired ? (
          <Alert tone="info">{t("client_proposal.expired")}</Alert>
        ) : (
          <>
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-primary">{t("client_proposal.choose_plan")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {proposal.plans.map((p) => (
                  <label
                    key={p.name}
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-4 py-3 ${
                      plan === p.name ? "border-action bg-background" : "border-line bg-white hover:bg-background"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="plan"
                        value={p.name}
                        checked={plan === p.name}
                        onChange={() => {
                          setPlan(p.name);
                          setAgreed(false);
                        }}
                        className="accent-action"
                      />
                      <span className="font-semibold text-primary">{p.name}</span>
                    </span>
                    <span className="text-xl font-light text-primary">{format.aed(p.price_aed)}</span>
                    {p.includes_bank_account && <span className="text-sm text-muted">{t("client_proposal.includes_bank")}</span>}
                  </label>
                ))}
              </div>
            </fieldset>
            {plan && (
              <div className="flex flex-col gap-4">
                {text.isPending && <Spinner />}
                {text.isError && <Alert>{t("client_proposal.text_error")}</Alert>}
                {text.data && (
                  <blockquote className="rounded-md border-l-4 border-action bg-background px-4 py-3 text-sm text-primary">{text.data}</blockquote>
                )}
                <CheckboxField
                  label={t("client_proposal.agree")}
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  disabled={!text.data}
                />
                {error && <Alert>{error}</Alert>}
                <div>
                  <Button
                    type="button"
                    busy={accept.isPending}
                    disabled={!agreed || !text.data}
                    onClick={() => {
                      setError(null);
                      accept.mutate();
                    }}
                  >
                    {t("client_proposal.accept")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function AcceptedProposal({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation();
  const format = useFormat();
  const chosen = proposal.plans.find((p) => p.name === proposal.chosen_plan);
  return (
    <Card title={<span className="flex flex-wrap items-center gap-2">{proposal.reference}<Badge tone="success">{t("proposal_status.accepted")}</Badge></span>}>
      <div className="flex flex-col gap-4">
        <DataList
          items={[
            { label: t("client_proposal.chosen_plan"), value: proposal.chosen_plan ?? "—" },
            { label: t("proposals.price"), value: format.aed(chosen?.price_aed) },
            { label: t("client_proposal.accepted_at"), value: format.dateTime(proposal.accepted_at) },
          ]}
        />
        {proposal.accepted_text && (
          <div className="rounded-md bg-background px-4 py-3 text-sm">
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{t("client_proposal.receipt")}</p>
            <p className="text-primary">{proposal.accepted_text}</p>
          </div>
        )}
        <PdfButton proposal={proposal} />
      </div>
    </Card>
  );
}
