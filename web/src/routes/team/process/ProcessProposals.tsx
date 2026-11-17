// Ficha · Proposta: rascunhos com planos e PDF, envio ao cliente e registo da aceitação.
// Regras na base de dados: só se envia com PDF e planos; só o cliente aceita; uma proposta aceite
// não muda nem se apaga. O PDF vai para o Storage na pasta da organização.
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { Alert, Badge, type BadgeTone, Button, Card, CheckboxField, DataList, Spinner, TextField } from "../../../components/ui";
import { openDownload } from "../../../lib/download";
import { errorKey } from "../../../lib/errors";
import { useOrg } from "../../../lib/OrgProvider";
import { supabase } from "../../../lib/supabase";
import { fileNameOf, plansError, type ProposalPlan, proposalPdfPath, type ProposalStatus } from "../../../lib/team";
import { useFormat } from "../../../lib/teamData";
import { useProcess } from "./ProcessLayout";

interface ProposalRow {
  id: string;
  reference: string;
  pdf_path: string | null;
  plans: ProposalPlan[];
  chosen_plan: string | null;
  valid_until: string | null;
  status: ProposalStatus;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_text: string | null;
  declined_at: string | null;
  created_at: string;
}

const TONES: Record<ProposalStatus, BadgeTone> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  expired: "warning",
  declined: "danger",
};

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export default function ProcessProposals() {
  const { t } = useTranslation();
  const { process, closed, refresh } = useProcess();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const proposals = useQuery({
    queryKey: ["team-proposals", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, reference, pdf_path, plans, chosen_plan, valid_until, status, sent_at, accepted_at, accepted_text, declined_at, created_at")
        .eq("process_id", process.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProposalRow[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ proposal, status }: { proposal: ProposalRow; status: ProposalStatus }) => {
      const { error } = await supabase.from("proposals").update({ status }).eq("id", proposal.id);
      if (error) throw error;
      return { proposal, status };
    },
    onSuccess: async ({ proposal, status }) => {
      setMessage({ tone: "success", text: t(`proposals.status_changed.${status}`, { reference: proposal.reference }) });
      await proposals.refetch();
      await refresh();
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });

  const remove = useMutation({
    mutationFn: async (proposal: ProposalRow) => {
      const { error } = await supabase.from("proposals").delete().eq("id", proposal.id);
      if (error) throw error;
      return proposal;
    },
    onSuccess: async (proposal) => {
      setMessage({ tone: "success", text: t("proposals.removed", { reference: proposal.reference }) });
      await proposals.refetch();
      await refresh();
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });

  const rows = proposals.data ?? [];
  const accepted = rows.some((p) => p.status === "accepted");
  const busy = setStatus.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted">{t("proposals.intro")}</p>
        {!closed && !accepted && editing === null && (
          <Button type="button" onClick={() => setEditing("new")}>
            {t("proposals.new")}
          </Button>
        )}
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {proposals.isPending && <Spinner />}
      {proposals.isError && <Alert>{t("proposals.load_error")}</Alert>}
      {editing === "new" && (
        <ProposalForm
          onDone={async (text) => {
            setEditing(null);
            if (text) setMessage({ tone: "success", text });
            await proposals.refetch();
          }}
        />
      )}
      {proposals.isSuccess && rows.length === 0 && editing === null && (
        <div className="rounded-lg border border-dashed border-line bg-white px-5 py-8 text-center text-muted">{t("proposals.empty")}</div>
      )}
      {rows.map((proposal) =>
        editing === proposal.id ? (
          <ProposalForm
            key={proposal.id}
            proposal={proposal}
            onDone={async (text) => {
              setEditing(null);
              if (text) setMessage({ tone: "success", text });
              await proposals.refetch();
            }}
          />
        ) : (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            actions={
              closed || editing !== null ? null : (
                <ProposalActions
                  proposal={proposal}
                  busy={busy}
                  onEdit={() => setEditing(proposal.id)}
                  onStatus={(status) => {
                    setMessage(null);
                    setStatus.mutate({ proposal, status });
                  }}
                  onRemove={() => {
                    setMessage(null);
                    remove.mutate(proposal);
                  }}
                />
              )
            }
          />
        )
      )}
    </div>
  );
}

function ProposalCard({ proposal, actions }: { proposal: ProposalRow; actions: ReactNode }) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {proposal.reference}
          <Badge tone={TONES[proposal.status]}>{t(`proposal_status.${proposal.status}`)}</Badge>
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <DataList
          items={[
            { label: t("proposals.valid_until"), value: format.date(proposal.valid_until) },
            { label: t("proposals.pdf"), value: fileNameOf(proposal.pdf_path) ?? t("proposals.no_pdf") },
            ...(proposal.sent_at ? [{ label: t("proposals.sent_at"), value: format.dateTime(proposal.sent_at) }] : []),
            ...(proposal.accepted_at ? [{ label: t("proposals.accepted_at"), value: format.dateTime(proposal.accepted_at) }] : []),
            ...(proposal.declined_at ? [{ label: t("proposals.declined_at"), value: format.dateTime(proposal.declined_at) }] : []),
          ]}
        />
        {proposal.plans.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-background text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-3 py-2">{t("proposals.plan")}</th>
                  <th className="px-3 py-2">{t("proposals.price")}</th>
                  <th className="px-3 py-2">{t("proposals.bank_account")}</th>
                </tr>
              </thead>
              <tbody>
                {proposal.plans.map((plan) => (
                  <tr key={plan.name} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold text-primary">
                      {plan.name}
                      {proposal.chosen_plan === plan.name && (
                        <span className="ml-2">
                          <Badge tone="success">{t("proposals.chosen")}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{format.aed(plan.price_aed)}</td>
                    <td className="px-3 py-2">{plan.includes_bank_account ? t("actions.yes") : t("actions.no")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">{t("proposals.no_plans")}</p>
        )}
        {proposal.pdf_path && <OpenPdf proposalId={proposal.id} />}
        {proposal.accepted_text && (
          <div className="rounded-md bg-background px-4 py-3 text-sm">
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{t("proposals.accepted_text")}</p>
            <p className="text-primary">{proposal.accepted_text}</p>
          </div>
        )}
        {actions}
      </div>
    </Card>
  );
}

function OpenPdf({ proposalId }: { proposalId: string }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            setError(null);
            const code = await openDownload("proposal", proposalId);
            if (code) setError(t(`errors.${code}`, { defaultValue: t("errors.generic") }));
          }}
        >
          {t("proposals.open_pdf")}
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

function ProposalActions({
  proposal,
  busy,
  onEdit,
  onStatus,
  onRemove,
}: {
  proposal: ProposalRow;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: ProposalStatus) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const ready = proposal.pdf_path !== null && proposal.plans.length > 0;
  if (proposal.status === "accepted") return null;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {proposal.status === "draft" && (
          <>
            <Button type="button" variant="secondary" onClick={onEdit} disabled={busy}>
              {t("actions.edit")}
            </Button>
            <ConfirmButton
              variant="primary"
              label={t("proposals.send")}
              confirmLabel={t("proposals.send_confirm")}
              question={t("proposals.send_question")}
              disabled={!ready}
              busy={busy}
              onConfirm={() => onStatus("sent")}
            />
          </>
        )}
        {proposal.status === "sent" && (
          <>
            <ConfirmButton
              label={t("proposals.mark_declined")}
              confirmLabel={t("proposals.mark_declined")}
              question={t("proposals.mark_question")}
              busy={busy}
              onConfirm={() => onStatus("declined")}
            />
            <ConfirmButton
              label={t("proposals.mark_expired")}
              confirmLabel={t("proposals.mark_expired")}
              question={t("proposals.mark_question")}
              busy={busy}
              onConfirm={() => onStatus("expired")}
            />
            <ConfirmButton
              variant="link"
              label={t("proposals.back_to_draft")}
              confirmLabel={t("proposals.back_to_draft")}
              question={t("proposals.back_to_draft_question")}
              busy={busy}
              onConfirm={() => onStatus("draft")}
            />
          </>
        )}
        {proposal.status !== "sent" && (
          <ConfirmButton
            variant="link"
            label={t("actions.remove")}
            confirmLabel={t("proposals.remove_confirm")}
            question={t("proposals.remove_question")}
            busy={busy}
            onConfirm={onRemove}
          />
        )}
      </div>
      {proposal.status === "draft" && !ready && <p className="text-sm text-muted">{t("proposals.send_requirements")}</p>}
    </div>
  );
}

interface FormValues {
  plans: { name: string; price_aed: string; includes_bank_account: boolean }[];
  valid_until: string;
  confirm_client_version: boolean;
}

function ProposalForm({ proposal, onDone }: { proposal?: ProposalRow; onDone: (message: string | null) => void }) {
  const { t } = useTranslation();
  const org = useOrg();
  const { process } = useProcess();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const reference = useQuery({
    queryKey: ["next-proposal-reference", org.id],
    enabled: !proposal,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("next_proposal_reference", { p_org: org.id });
      if (error) throw error;
      return data as string;
    },
  });

  const { register, control, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: {
      plans: proposal?.plans.length
        ? proposal.plans.map((p) => ({ name: p.name, price_aed: String(p.price_aed), includes_bank_account: p.includes_bank_account }))
        : [{ name: "", price_aed: "", includes_bank_account: false }],
      valid_until: proposal?.valid_until ?? "",
      confirm_client_version: false,
    },
  });
  const plans = useFieldArray({ control, name: "plans" });
  const confirmed = watch("confirm_client_version");

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const cleanPlans: ProposalPlan[] = values.plans.map((p) => ({
        name: p.name.trim(),
        price_aed: Number(p.price_aed),
        includes_bank_account: p.includes_bank_account,
      }));
      const problem = plansError(cleanPlans);
      if (problem) throw new Error(`proposals.errors.${problem}`);
      if (file && file.type !== "application/pdf") throw new Error("proposals.errors.pdf_type");
      if (file && file.size > MAX_PDF_BYTES) throw new Error("proposals.errors.pdf_size");
      if (file && !values.confirm_client_version) throw new Error("proposals.errors.confirm_required");

      const fields = { plans: cleanPlans, valid_until: values.valid_until || null };
      let id = proposal?.id;
      let ref = proposal?.reference ?? reference.data ?? "";
      if (!id) {
        let inserted = await supabase
          .from("proposals")
          .insert({ ...fields, organization_id: org.id, process_id: process.id, reference: ref, status: "draft" })
          .select("id")
          .single();
        if (inserted.error?.code === "23505") {
          // Outra proposta ficou com esta referência entretanto: pede a seguinte e tenta outra vez.
          const next = await supabase.rpc("next_proposal_reference", { p_org: org.id });
          if (next.error) throw next.error;
          ref = next.data as string;
          inserted = await supabase
            .from("proposals")
            .insert({ ...fields, organization_id: org.id, process_id: process.id, reference: ref, status: "draft" })
            .select("id")
            .single();
        }
        if (inserted.error) throw inserted.error;
        id = (inserted.data as { id: string }).id;
      } else {
        const { error } = await supabase.from("proposals").update(fields).eq("id", id);
        if (error) throw error;
      }

      if (file) {
        const path = proposalPdfPath(org.id, process.id, id, file.name);
        const upload = await supabase.storage.from("documents").upload(path, file, { contentType: "application/pdf", upsert: false });
        if (upload.error) throw new Error("proposals.errors.pdf_upload");
        const { error } = await supabase.from("proposals").update({ pdf_path: path }).eq("id", id);
        if (error) throw error;
      }
      return ref;
    },
    onSuccess: (ref) => onDone(proposal ? t("proposals.saved", { reference: ref }) : t("proposals.created", { reference: ref })),
    onError: (e) => setError(e.message.startsWith("proposals.errors.") ? t(e.message) : t(errorKey(e))),
  });

  const title = proposal?.reference ?? reference.data ?? "…";
  return (
    <Card title={proposal ? t("proposals.edit_title", { reference: title }) : t("proposals.new_title", { reference: title })}>
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={handleSubmit((values) => {
          setError(null);
          save.mutate(values);
        })}
      >
        {error && <Alert>{error}</Alert>}
        {reference.isError && <Alert>{t("proposals.reference_error")}</Alert>}

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-primary">{t("proposals.plans")}</p>
          {plans.fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-end">
              <TextField label={t("proposals.plan")} autoComplete="off" {...register(`plans.${index}.name`)} />
              <TextField label={t("proposals.price_aed")} type="number" min={0} step="0.01" inputMode="decimal" {...register(`plans.${index}.price_aed`)} />
              <CheckboxField className="sm:pb-3" label={t("proposals.bank_account")} {...register(`plans.${index}.includes_bank_account`)} />
              <Button type="button" variant="link" className="sm:pb-3" disabled={plans.fields.length === 1} onClick={() => plans.remove(index)}>
                {t("actions.remove")}
              </Button>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" onClick={() => plans.append({ name: "", price_aed: "", includes_bank_account: false })}>
              {t("proposals.add_plan")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("proposals.valid_until")} type="date" {...register("valid_until")} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="proposal-pdf" className="text-sm font-semibold text-primary">
              {proposal?.pdf_path ? t("proposals.replace_pdf") : t("proposals.pdf")}
            </label>
            <input
              id="proposal-pdf"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-2 file:font-semibold file:text-primary"
            />
            {proposal?.pdf_path && <p className="text-sm text-muted">{t("proposals.current_pdf", { name: fileNameOf(proposal.pdf_path) })}</p>}
          </div>
        </div>

        {file && (
          <CheckboxField label={t("proposals.confirm_client_version")} hint={t("proposals.confirm_client_version_hint")} {...register("confirm_client_version")} />
        )}

        <div className="flex gap-2">
          <Button type="submit" busy={save.isPending} disabled={(!proposal && !reference.data) || (!!file && !confirmed)}>
            {t("proposals.save_draft")}
          </Button>
          <Button type="button" variant="link" onClick={() => onDone(null)}>
            {t("actions.cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
