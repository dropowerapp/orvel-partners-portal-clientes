// Ficha · Resumo: próximo passo, dados do cliente, acesso ao portal (convite) e dados do processo.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, CheckboxField, TextField } from "../../../components/ui";
import { errorKey, functionErrorCode } from "../../../lib/errors";
import { supabase } from "../../../lib/supabase";
import { useFormat } from "../../../lib/teamData";
import { type ProcessClient, type ProcessDetail, useProcess } from "./ProcessLayout";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function ProcessSummary() {
  const { t } = useTranslation();
  const { process, closed } = useProcess();
  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info">
        <span className="font-semibold">{t("summary.next_step")}</span> {t(`summary.next.${process.status}`)}
      </Alert>
      <div className="grid gap-6 lg:grid-cols-2">
        <ClientCard key={JSON.stringify(process.client)} client={process.client} readOnly={closed} />
        <div className="flex flex-col gap-6">
          <AccessCard client={process.client} />
          <ProcessCard key={JSON.stringify([process.plan_name, process.free_zone, process.visa_count, process.includes_bank_account, process.company_name_options])} process={process} readOnly={closed} />
        </div>
      </div>
    </div>
  );
}

type ClientValues = Pick<ProcessClient, "full_name" | "email"> & {
  phone: string;
  country: string;
  address_line: string;
  city: string;
  postal_code: string;
  address_country: string;
};

const nullIfEmpty = (value: string) => (value.trim() === "" ? null : value.trim());

function ClientCard({ client, readOnly }: { client: ProcessClient; readOnly: boolean }) {
  const { t } = useTranslation();
  const { refresh } = useProcess();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const { register, handleSubmit, formState, reset } = useForm<ClientValues>({
    defaultValues: {
      full_name: client.full_name,
      email: client.email,
      phone: client.phone ?? "",
      country: client.country ?? "",
      address_line: client.address_line ?? "",
      city: client.city ?? "",
      postal_code: client.postal_code ?? "",
      address_country: client.address_country ?? "",
    },
  });
  // Depois do convite, o email é o da conta de acesso: não se muda aqui.
  const emailLocked = client.invited_at !== null;

  const save = useMutation({
    mutationFn: async (values: ClientValues) => {
      const { error } = await supabase
        .from("clients")
        .update({
          full_name: values.full_name.trim(),
          ...(emailLocked ? {} : { email: values.email.trim().toLowerCase() }),
          phone: nullIfEmpty(values.phone),
          country: nullIfEmpty(values.country),
          address_line: nullIfEmpty(values.address_line),
          city: nullIfEmpty(values.city),
          postal_code: nullIfEmpty(values.postal_code),
          address_country: nullIfEmpty(values.address_country),
        })
        .eq("id", client.id);
      if (error) throw error;
      return values;
    },
    onSuccess: async (values) => {
      reset(values);
      setMessage({ tone: "success", text: t("summary.saved") });
      void queryClient.invalidateQueries({ queryKey: ["team-clients"] });
      await refresh();
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });

  const required = { required: t("validation.required") };
  return (
    <Card title={t("summary.client_title")}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => {
          setMessage(null);
          save.mutate(values);
        })}
      >
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("fields.full_name")} error={formState.errors.full_name?.message} {...register("full_name", required)} />
          <TextField
            label={t("fields.email")}
            type="email"
            disabled={emailLocked || readOnly}
            hint={emailLocked ? t("summary.email_locked") : undefined}
            error={formState.errors.email?.message}
            {...register("email", { ...required, pattern: { value: EMAIL, message: t("validation.email") } })}
          />
          <TextField label={t("fields.phone")} type="tel" {...register("phone")} />
          <TextField label={t("fields.country")} {...register("country")} />
          <TextField label={t("fields.address_line")} className="sm:col-span-2" {...register("address_line")} />
          <TextField label={t("fields.city")} {...register("city")} />
          <TextField label={t("fields.postal_code")} {...register("postal_code")} />
          <TextField label={t("fields.address_country")} {...register("address_country")} />
        </fieldset>
        {!readOnly && (
          <div>
            <Button type="submit" variant="secondary" busy={save.isPending} disabled={!formState.isDirty}>
              {t("actions.save")}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function AccessCard({ client }: { client: ProcessClient }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { refresh } = useProcess();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("invite-client", { body: { client_id: client.id } });
      if (error) throw new Error(await functionErrorCode(error));
    },
    onSuccess: async () => {
      setMessage({ tone: "success", text: t("team_home.sent", { email: client.email }) });
      void queryClient.invalidateQueries({ queryKey: ["team-clients"] });
      await refresh();
    },
    onError: (e) => setMessage({ tone: "error", text: t(`errors.${e.message}`) }),
  });

  return (
    <Card title={t("summary.access_title")}>
      <div className="flex flex-col gap-4">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <p className="text-sm text-muted">
          {client.last_invite_sent_at
            ? t("team_home.invited_on", { date: format.dateTime(client.last_invite_sent_at) })
            : t("summary.not_invited")}
        </p>
        <div>
          <Button
            variant="secondary"
            busy={invite.isPending}
            onClick={() => {
              setMessage(null);
              invite.mutate();
            }}
          >
            {invite.isPending ? t("team_home.sending") : client.invited_at ? t("team_home.resend") : t("team_home.invite")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface ProcessValues {
  plan_name: string;
  free_zone: string;
  visa_count: string;
  includes_bank_account: boolean;
  name_1: string;
  name_2: string;
  name_3: string;
}

function ProcessCard({ process, readOnly }: { process: ProcessDetail; readOnly: boolean }) {
  const { t } = useTranslation();
  const { refresh } = useProcess();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const names = process.company_name_options;
  const { register, handleSubmit, formState, reset } = useForm<ProcessValues>({
    defaultValues: {
      plan_name: process.plan_name ?? "",
      free_zone: process.free_zone ?? "",
      visa_count: process.visa_count === null ? "" : String(process.visa_count),
      includes_bank_account: process.includes_bank_account,
      name_1: names[0] ?? "",
      name_2: names[1] ?? "",
      name_3: names[2] ?? "",
    },
  });

  const save = useMutation({
    mutationFn: async (values: ProcessValues) => {
      const { error } = await supabase
        .from("processes")
        .update({
          plan_name: nullIfEmpty(values.plan_name),
          free_zone: nullIfEmpty(values.free_zone),
          visa_count: values.visa_count === "" ? null : Number(values.visa_count),
          includes_bank_account: values.includes_bank_account,
          company_name_options: [values.name_1, values.name_2, values.name_3].map((n) => n.trim()).filter(Boolean),
        })
        .eq("id", process.id);
      if (error) throw error;
      return values;
    },
    onSuccess: async (values) => {
      reset(values);
      setMessage({ tone: "success", text: t("summary.saved") });
      await refresh();
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });

  return (
    <Card title={t("summary.process_title")}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => {
          setMessage(null);
          save.mutate(values);
        })}
      >
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <fieldset disabled={readOnly} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={t("fields.plan_name")} hint={t("summary.plan_hint")} {...register("plan_name")} />
            <TextField label={t("fields.free_zone")} {...register("free_zone")} />
            <TextField
              label={t("fields.visa_count")}
              type="number"
              min={0}
              max={50}
              error={formState.errors.visa_count?.message}
              {...register("visa_count", { min: { value: 0, message: t("validation.number_range") }, max: { value: 50, message: t("validation.number_range") } })}
            />
          </div>
          <CheckboxField label={t("fields.includes_bank_account")} hint={t("summary.bank_hint")} {...register("includes_bank_account")} />
          <div>
            <p className="mb-2 text-sm font-semibold text-primary">{t("fields.company_names")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField label={t("summary.name_option", { n: 1 })} {...register("name_1")} />
              <TextField label={t("summary.name_option", { n: 2 })} {...register("name_2")} />
              <TextField label={t("summary.name_option", { n: 3 })} {...register("name_3")} />
            </div>
          </div>
        </fieldset>
        {!readOnly && (
          <div>
            <Button type="submit" variant="secondary" busy={save.isPending} disabled={!formState.isDirty}>
              {t("actions.save")}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
