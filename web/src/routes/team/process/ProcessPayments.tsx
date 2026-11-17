// Ficha · Pagamentos: valores em AED, estado de cada pagamento e libertação dos dados bancários
// (a base de dados só deixa libertar depois de a proposta ser aceite e com uma conta escolhida).
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { Alert, Badge, type BadgeTone, Button, Card, DataList, SelectField, Spinner, TextField } from "../../../components/ui";
import { errorKey } from "../../../lib/errors";
import { useOrg } from "../../../lib/OrgProvider";
import { supabase } from "../../../lib/supabase";
import { type PaymentStatus, paymentTotals } from "../../../lib/team";
import { useFormat, useTeamSettings } from "../../../lib/teamData";
import { useProcess } from "./ProcessLayout";

interface PaymentRow {
  id: string;
  description: string;
  amount_aed: number;
  amount_paid_aed: number;
  status: PaymentStatus;
  due_on: string | null;
  paid_on: string | null;
}

interface BankAccount {
  id: string;
  label: string;
  bank_name: string;
  currency: string;
}

const TONES: Record<PaymentStatus, BadgeTone> = { pending: "warning", partial: "info", paid: "success" };

type Message = { tone: "success" | "error"; text: string } | null;

export default function ProcessPayments() {
  const { t } = useTranslation();
  const format = useFormat();
  const { today } = useTeamSettings();
  const { process, closed, refresh } = useProcess();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const payments = useQuery({
    queryKey: ["team-payments", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, description, amount_aed, amount_paid_aed, status, due_on, paid_on")
        .eq("process_id", process.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (payment: PaymentRow) => {
      const { error } = await supabase.from("payments").delete().eq("id", payment.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage({ tone: "success", text: t("payments.removed") });
      await payments.refetch();
      await refresh();
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });

  const rows = payments.data ?? [];
  const totals = paymentTotals(rows);
  const done = async (text: string | null) => {
    setEditing(null);
    if (text) setMessage({ tone: "success", text });
    await payments.refetch();
    await refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <Card
        title={t("payments.title")}
        actions={
          !closed && editing === null && (
            <Button type="button" variant="secondary" onClick={() => setEditing("new")}>
              {t("payments.add")}
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
          <DataList
            items={[
              { label: t("payments.total"), value: format.aed(totals.total) },
              { label: t("payments.paid"), value: format.aed(totals.paid) },
              { label: t("payments.outstanding"), value: format.aed(totals.outstanding) },
            ]}
          />
          {payments.isPending && <Spinner />}
          {payments.isError && <Alert>{t("payments.load_error")}</Alert>}
          {editing === "new" && <PaymentForm onDone={done} />}
          {payments.isSuccess && rows.length === 0 && editing !== "new" && <p className="text-sm text-muted">{t("payments.empty")}</p>}
          <ul className="divide-y divide-line">
            {rows.map((payment) => {
              if (editing === payment.id) {
                return (
                  <li key={payment.id} className="py-3">
                    <PaymentForm payment={payment} onDone={done} />
                  </li>
                );
              }
              const overdue = payment.status !== "paid" && payment.due_on !== null && payment.due_on < today;
              return (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-primary">
                      {payment.description || t("payments.no_description")}
                      <Badge tone={TONES[payment.status]}>{t(`payment_status.${payment.status}`)}</Badge>
                      {overdue && <Badge tone="danger">{t("payments.overdue")}</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      {[
                        format.aed(payment.amount_aed),
                        payment.status === "partial" ? t("payments.paid_amount", { amount: format.aed(payment.amount_paid_aed) }) : null,
                        payment.due_on ? t("payments.due_on", { date: format.date(payment.due_on) }) : null,
                        payment.paid_on ? t("payments.paid_on", { date: format.date(payment.paid_on) }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {!closed && editing === null && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="secondary" onClick={() => setEditing(payment.id)}>
                        {t("actions.edit")}
                      </Button>
                      <ConfirmButton
                        variant="link"
                        label={t("actions.remove")}
                        confirmLabel={t("payments.remove_confirm")}
                        question={t("payments.remove_question")}
                        busy={remove.isPending && remove.variables?.id === payment.id}
                        onConfirm={() => {
                          setMessage(null);
                          remove.mutate(payment);
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </Card>
      <BankDetailsCard />
    </div>
  );
}

interface PaymentValues {
  description: string;
  amount_aed: string;
  due_on: string;
  status: PaymentStatus;
  amount_paid_aed: string;
  paid_on: string;
}

function PaymentForm({ payment, onDone }: { payment?: PaymentRow; onDone: (message: string | null) => void }) {
  const { t } = useTranslation();
  const org = useOrg();
  const { process } = useProcess();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState } = useForm<PaymentValues>({
    defaultValues: {
      description: payment?.description ?? "",
      amount_aed: payment ? String(payment.amount_aed) : "",
      due_on: payment?.due_on ?? "",
      status: payment?.status ?? "pending",
      amount_paid_aed: payment && payment.status === "partial" ? String(payment.amount_paid_aed) : "",
      paid_on: payment?.paid_on ?? "",
    },
  });
  const status = watch("status");

  const save = useMutation({
    mutationFn: async (values: PaymentValues) => {
      const amount = Number(values.amount_aed);
      const paid = Number(values.amount_paid_aed);
      if (!(amount > 0)) throw new Error("payments.errors.amount");
      if (values.status === "partial" && !(paid > 0 && paid < amount)) throw new Error("payments.errors.partial");
      const row = {
        description: values.description.trim(),
        amount_aed: amount,
        due_on: values.due_on || null,
        status: values.status,
        // "Pago" e "Por pagar" acertam o valor pago na base de dados.
        ...(values.status === "partial" ? { amount_paid_aed: paid } : {}),
        paid_on: values.status === "pending" ? null : values.paid_on || null,
      };
      const { error } = payment
        ? await supabase.from("payments").update(row).eq("id", payment.id)
        : await supabase.from("payments").insert({ ...row, organization_id: org.id, process_id: process.id });
      if (error) throw error;
    },
    onSuccess: () => onDone(payment ? t("payments.saved") : t("payments.added")),
    onError: (e) => setError(e.message.startsWith("payments.errors.") ? t(e.message) : t(errorKey(e))),
  });

  const statusOptions = (["pending", "partial", "paid"] as const).map((s) => ({ value: s, label: t(`payment_status.${s}`) }));
  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-md border border-line bg-background p-4"
      onSubmit={handleSubmit((values) => {
        setError(null);
        save.mutate(values);
      })}
    >
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label={t("payments.description")} className="sm:col-span-3" autoComplete="off" placeholder={t("payments.description_placeholder")} {...register("description")} />
        <TextField
          label={t("payments.amount_aed")}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          error={formState.errors.amount_aed?.message}
          {...register("amount_aed", { required: t("validation.required") })}
        />
        <TextField label={t("payments.due_date")} type="date" {...register("due_on")} />
        <SelectField label={t("payments.status")} options={statusOptions} {...register("status")} />
        {status === "partial" && (
          <TextField label={t("payments.amount_paid_aed")} type="number" min={0} step="0.01" inputMode="decimal" {...register("amount_paid_aed")} />
        )}
        {status !== "pending" && <TextField label={t("payments.paid_date")} type="date" hint={t("payments.paid_date_hint")} {...register("paid_on")} />}
      </div>
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

function BankDetailsCard() {
  const { t } = useTranslation();
  const org = useOrg();
  const format = useFormat();
  const { process, closed, refresh } = useProcess();
  const [message, setMessage] = useState<Message>(null);
  const [accountId, setAccountId] = useState(process.bank_account_id ?? "");

  const accounts = useQuery({
    queryKey: ["team-bank-accounts", org.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, label, bank_name, currency")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .order("label");
      if (error) throw error;
      return (data ?? []) as BankAccount[];
    },
  });

  const update = useMutation({
    mutationFn: async (change: { bank_account_id?: string | null; bank_details_released_at?: string | null }) => {
      const { error } = await supabase.from("processes").update(change).eq("id", process.id);
      if (error) throw error;
      return change;
    },
    onSuccess: async (change) => {
      setMessage({
        tone: "success",
        text:
          change.bank_details_released_at === undefined
            ? t("payments.bank_account_saved")
            : change.bank_details_released_at
            ? t("payments.bank_released")
            : t("payments.bank_hidden"),
      });
      await refresh();
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });

  const options = [
    { value: "", label: t("payments.bank_account_none") },
    ...(accounts.data ?? []).map((a) => ({ value: a.id, label: `${a.label} · ${a.bank_name} (${a.currency})` })),
  ];
  const released = process.bank_details_released_at !== null;

  return (
    <Card title={t("payments.bank_title")}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("payments.bank_intro")}</p>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label={t("payments.bank_account")}
            className="min-w-64"
            options={options}
            value={accountId}
            disabled={closed || released || accounts.isPending}
            onChange={(e) => setAccountId(e.target.value)}
          />
          {!closed && !released && (
            <Button
              type="button"
              variant="secondary"
              busy={update.isPending}
              disabled={accountId === (process.bank_account_id ?? "")}
              onClick={() => {
                setMessage(null);
                update.mutate({ bank_account_id: accountId || null });
              }}
            >
              {t("actions.save")}
            </Button>
          )}
        </div>
        {released ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success">{t("payments.bank_released_on", { date: format.dateTime(process.bank_details_released_at) })}</Badge>
            {!closed && (
              <ConfirmButton
                variant="link"
                label={t("payments.bank_hide")}
                confirmLabel={t("payments.bank_hide")}
                question={t("payments.bank_hide_question")}
                busy={update.isPending}
                onConfirm={() => {
                  setMessage(null);
                  update.mutate({ bank_details_released_at: null });
                }}
              />
            )}
          </div>
        ) : (
          !closed && (
            <div>
              <ConfirmButton
                label={t("payments.bank_release")}
                confirmLabel={t("payments.bank_release")}
                question={t("payments.bank_release_question")}
                disabled={!process.bank_account_id}
                busy={update.isPending}
                onConfirm={() => {
                  setMessage(null);
                  update.mutate({ bank_details_released_at: new Date().toISOString() });
                }}
              />
            </div>
          )
        )}
      </div>
    </Card>
  );
}
