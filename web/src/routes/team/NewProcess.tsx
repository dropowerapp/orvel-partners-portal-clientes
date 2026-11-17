// E3 · Novo cliente: cria o cliente (ou usa um existente, com ?cliente=id), o processo e as
// pessoas numa só operação (função create_client_process). Os pedidos de documentos e a
// cronologia nascem dos modelos da organização. O convite pode seguir logo ou mais tarde.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Alert, Button, Card, CheckboxField, PageTitle, SelectField, Spinner, TextField } from "../../components/ui";
import { errorKey, functionErrorCode } from "../../lib/errors";
import { useOrg } from "../../lib/OrgProvider";
import { supabase } from "../../lib/supabase";
import { TEAM_PATHS } from "../../lib/teamData";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f-]{36}$/i;

interface PersonValues {
  relationship: "spouse" | "child" | "other";
  full_name: string;
  nationality: string;
  date_of_birth: string;
}

interface Values {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  holder_name: string;
  nationality: string;
  date_of_birth: string;
  plan_name: string;
  free_zone: string;
  visa_count: string;
  includes_bank_account: boolean;
  people: PersonValues[];
  send_invite: boolean;
}

export interface ProcessFlash {
  tone: "success" | "error";
  text: string;
}

export default function NewProcess() {
  const { t } = useTranslation();
  const org = useOrg();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const existingId = params.get("cliente");
  const clientId = existingId && UUID.test(existingId) ? existingId : null;
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ["team-client", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, full_name, email").eq("id", clientId!).single();
      if (error) throw error;
      return data as { id: string; full_name: string; email: string };
    },
  });

  const { register, control, handleSubmit, formState } = useForm<Values>({
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      country: "",
      holder_name: "",
      nationality: "",
      date_of_birth: "",
      plan_name: "",
      free_zone: "",
      visa_count: "",
      includes_bank_account: false,
      people: [],
      send_invite: false,
    },
  });
  const people = useFieldArray({ control, name: "people" });

  const create = useMutation({
    mutationFn: async (values: Values) => {
      const client = clientId
        ? { id: clientId, holder_name: values.holder_name, nationality: values.nationality, date_of_birth: values.date_of_birth }
        : {
          full_name: values.full_name,
          email: values.email,
          phone: values.phone,
          country: values.country,
          holder_name: values.holder_name,
          nationality: values.nationality,
          date_of_birth: values.date_of_birth,
        };
      const { data: processId, error } = await supabase.rpc("create_client_process", {
        p_org: org.id,
        p_client: client,
        p_process: {
          plan_name: values.plan_name,
          free_zone: values.free_zone,
          visa_count: values.visa_count,
          includes_bank_account: values.includes_bank_account,
        },
        p_people: values.people.filter((p) => p.full_name.trim()),
      });
      if (error) throw error;

      let flash: ProcessFlash = { tone: "success", text: t("new_process.created") };
      if (values.send_invite) {
        const { data: proc } = await supabase.from("processes").select("client_id").eq("id", processId as string).single();
        const { error: inviteError } = await supabase.functions.invoke("invite-client", {
          body: { client_id: (proc as { client_id: string } | null)?.client_id },
        });
        flash = inviteError
          ? { tone: "error", text: t("new_process.created_invite_failed", { reason: t(`errors.${await functionErrorCode(inviteError)}`) }) }
          : { tone: "success", text: t("new_process.created_invited") };
      }
      return { processId: processId as string, flash };
    },
    onSuccess: ({ processId, flash }) => {
      void queryClient.invalidateQueries({ queryKey: ["team-processes"] });
      void queryClient.invalidateQueries({ queryKey: ["team-clients"] });
      navigate(TEAM_PATHS.process(processId), { state: { flash } });
    },
    onError: (e) => setError(t(errorKey(e))),
  });

  if (clientId && existing.isPending) return <Spinner />;
  if (clientId && existing.isError) return <Alert>{t("errors.not_found")}</Alert>;

  const required = { required: t("validation.required") };
  const relationshipOptions = (["spouse", "child", "other"] as const).map((r) => ({ value: r, label: t(`relationship.${r}`) }));

  return (
    <>
      <PageTitle eyebrow={t("auth_layout.eyebrow_team")} title={clientId ? t("new_process.title_existing") : t("new_process.title")}>
        {t("new_process.intro")}
      </PageTitle>
      <form
        noValidate
        className="flex max-w-3xl flex-col gap-6"
        onSubmit={handleSubmit((values) => {
          setError(null);
          create.mutate(values);
        })}
      >
        {error && <Alert>{error}</Alert>}

        <Card title={t("new_process.section_client")}>
          {clientId && existing.data ? (
            <p className="text-sm">
              <span className="font-semibold text-primary">{existing.data.full_name}</span>
              <span className="text-muted"> · {existing.data.email}</span>
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t("fields.full_name")} autoComplete="off" error={formState.errors.full_name?.message} {...register("full_name", required)} />
              <TextField
                label={t("fields.email")}
                type="email"
                autoComplete="off"
                error={formState.errors.email?.message}
                {...register("email", { ...required, pattern: { value: EMAIL, message: t("validation.email") } })}
              />
              <TextField label={t("fields.phone")} type="tel" autoComplete="off" {...register("phone")} />
              <TextField label={t("fields.country")} autoComplete="off" {...register("country")} />
            </div>
          )}
        </Card>

        <Card title={t("new_process.section_holder")}>
          <p className="mb-4 text-sm text-muted">{t("new_process.holder_hint")}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={t("fields.holder_name")} autoComplete="off" placeholder={t("new_process.holder_placeholder")} {...register("holder_name")} />
            <TextField label={t("fields.nationality")} autoComplete="off" {...register("nationality")} />
            <TextField label={t("fields.date_of_birth")} type="date" {...register("date_of_birth")} />
          </div>
        </Card>

        <Card
          title={t("new_process.section_people")}
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={() => people.append({ relationship: "spouse", full_name: "", nationality: "", date_of_birth: "" })}
            >
              {t("new_process.add_person")}
            </Button>
          }
        >
          {people.fields.length === 0 && <p className="text-sm text-muted">{t("new_process.no_people")}</p>}
          <div className="flex flex-col gap-4">
            {people.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[10rem_1fr_10rem_10rem_auto] sm:items-end">
                <SelectField label={t("fields.relationship")} options={relationshipOptions} {...register(`people.${index}.relationship`)} />
                <TextField
                  label={t("fields.full_name")}
                  autoComplete="off"
                  error={formState.errors.people?.[index]?.full_name?.message}
                  {...register(`people.${index}.full_name`, required)}
                />
                <TextField label={t("fields.nationality")} autoComplete="off" {...register(`people.${index}.nationality`)} />
                <TextField label={t("fields.date_of_birth")} type="date" {...register(`people.${index}.date_of_birth`)} />
                <Button type="button" variant="link" onClick={() => people.remove(index)}>
                  {t("actions.remove")}
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t("new_process.section_process")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={t("fields.plan_name")} autoComplete="off" hint={t("new_process.plan_hint")} {...register("plan_name")} />
            <TextField label={t("fields.free_zone")} autoComplete="off" {...register("free_zone")} />
            <TextField
              label={t("fields.visa_count")}
              type="number"
              min={0}
              max={50}
              error={formState.errors.visa_count?.message}
              {...register("visa_count", { min: { value: 0, message: t("validation.number_range") }, max: { value: 50, message: t("validation.number_range") } })}
            />
          </div>
          <CheckboxField className="mt-4" label={t("fields.includes_bank_account")} {...register("includes_bank_account")} />
        </Card>

        <CheckboxField label={t("new_process.send_invite")} hint={t("new_process.send_invite_hint")} {...register("send_invite")} />

        <div className="flex flex-wrap gap-3">
          <Button type="submit" busy={create.isPending}>
            {create.isPending ? t("new_process.creating") : t("new_process.submit")}
          </Button>
          <Link to={TEAM_PATHS.processes} className="inline-flex items-center px-4 py-2.5 font-semibold text-primary-deep hover:underline">
            {t("actions.cancel")}
          </Link>
        </div>
      </form>
    </>
  );
}
