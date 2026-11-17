// Os meus dados: dados pessoais e de contacto, pessoas do processo (dependentes) e 2 a 3 nomes
// pretendidos para a empresa. As escritas passam pelas funções do cliente (update_my_details,
// save_person, delete_person, set_company_names), que validam e registam a atividade.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ConfirmButton } from "../../components/ConfirmButton";
import { Alert, Badge, Button, Card, PageTitle, SelectField, Spinner, TextField } from "../../components/ui";
import { useAuth } from "../../lib/AuthProvider";
import type { ClientProcess } from "../../lib/client";
import { useClientProcesses } from "../../lib/clientData";
import { errorKey } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import type { Relationship } from "../../lib/team";
import { useFormat } from "../../lib/teamData";

type Message = { tone: "success" | "error"; text: string } | null;

export default function ClientDetails() {
  const { t } = useTranslation();
  const { current } = useClientProcesses();
  const closed = !!current && (!!current.completed_at || !!current.cancelled_at);
  return (
    <>
      <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={t("client_details.title")}>
        {t("client_details.intro")}
      </PageTitle>
      <div className="flex flex-col gap-6">
        <MyDetails />
        {current && <CompanyNames key={current.id + current.company_name_options.join("|")} process={current} readOnly={closed} />}
        {current && <People processId={current.id} readOnly={closed} />}
      </div>
    </>
  );
}

interface DetailsValues {
  full_name: string;
  phone: string;
  country: string;
  address_line: string;
  city: string;
  postal_code: string;
  address_country: string;
}

function MyDetails() {
  const { t } = useTranslation();
  const { context } = useAuth();
  const clientId = context?.client_id ?? null;
  const query = useQuery({
    queryKey: ["my-details", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("full_name, email, phone, country, address_line, city, postal_code, address_country")
        .eq("id", clientId!)
        .single();
      if (error) throw error;
      return data as DetailsValues & { email: string };
    },
  });
  if (query.isPending) return <Spinner />;
  if (!query.data) return <Alert>{t("client_details.load_error")}</Alert>;
  return <MyDetailsForm key={JSON.stringify(query.data)} clientId={clientId!} data={query.data} />;
}

function MyDetailsForm({ clientId, data }: { clientId: string; data: DetailsValues & { email: string } }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<Message>(null);
  const empty = (v: string | null) => v ?? "";
  const { register, handleSubmit, formState, reset } = useForm<DetailsValues>({
    defaultValues: {
      full_name: data.full_name,
      phone: empty(data.phone),
      country: empty(data.country),
      address_line: empty(data.address_line),
      city: empty(data.city),
      postal_code: empty(data.postal_code),
      address_country: empty(data.address_country),
    },
  });
  const save = useMutation({
    mutationFn: async (v: DetailsValues) => {
      const { error } = await supabase.rpc("update_my_details", {
        p_client_id: clientId,
        p_full_name: v.full_name,
        p_phone: v.phone,
        p_country: v.country,
        p_address_line: v.address_line,
        p_city: v.city,
        p_postal_code: v.postal_code,
        p_address_country: v.address_country,
      });
      if (error) throw error;
      return v;
    },
    onSuccess: (v) => {
      reset(v);
      setMessage({ tone: "success", text: t("client_details.saved") });
      void queryClient.invalidateQueries({ queryKey: ["my-client"] });
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });
  return (
    <Card title={t("client_details.personal_title")}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) => {
          setMessage(null);
          save.mutate(v);
        })}
      >
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("fields.full_name")}
            autoComplete="name"
            error={formState.errors.full_name?.message}
            {...register("full_name", { validate: (v) => v.trim() !== "" || t("validation.required") })}
          />
          <TextField label={t("fields.email")} value={data.email} disabled readOnly hint={t("client_details.email_hint")} />
          <TextField label={t("fields.phone")} type="tel" autoComplete="tel" {...register("phone")} />
          <TextField label={t("fields.country")} autoComplete="country-name" {...register("country")} />
          <TextField label={t("fields.address_line")} className="sm:col-span-2" autoComplete="street-address" {...register("address_line")} />
          <TextField label={t("fields.city")} autoComplete="address-level2" {...register("city")} />
          <TextField label={t("fields.postal_code")} autoComplete="postal-code" {...register("postal_code")} />
          <TextField label={t("fields.address_country")} {...register("address_country")} />
        </div>
        <div>
          <Button type="submit" variant="secondary" busy={save.isPending} disabled={!formState.isDirty}>
            {t("actions.save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CompanyNames({ process, readOnly }: { process: ClientProcess; readOnly: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<Message>(null);
  const names = process.company_name_options;
  const { register, handleSubmit, formState, reset } = useForm({
    defaultValues: { name_1: names[0] ?? "", name_2: names[1] ?? "", name_3: names[2] ?? "" },
  });
  const save = useMutation({
    mutationFn: async (v: { name_1: string; name_2: string; name_3: string }) => {
      const { error } = await supabase.rpc("set_company_names", { p_process_id: process.id, p_names: [v.name_1, v.name_2, v.name_3] });
      if (error) throw error;
      return v;
    },
    onSuccess: (v) => {
      reset(v);
      setMessage({ tone: "success", text: t("client_details.names_saved") });
      void queryClient.invalidateQueries({ queryKey: ["client-processes"] });
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });
  return (
    <Card title={t("client_details.names_title")}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) => {
          setMessage(null);
          save.mutate(v);
        })}
      >
        <p className="text-sm text-muted">{t("client_details.names_intro")}</p>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <fieldset disabled={readOnly} className="grid gap-3 sm:grid-cols-3">
          <TextField label={t("summary.name_option", { n: 1 })} {...register("name_1")} />
          <TextField label={t("summary.name_option", { n: 2 })} {...register("name_2")} />
          <TextField label={t("summary.name_option", { n: 3 })} {...register("name_3")} />
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

interface PersonRow {
  id: string;
  relationship: Relationship;
  full_name: string;
  nationality: string | null;
  date_of_birth: string | null;
}

function People({ processId, readOnly }: { processId: string; readOnly: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const people = useQuery({
    queryKey: ["client", "people", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("id, relationship, full_name, nationality, date_of_birth")
        .eq("process_id", processId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });
  const remove = useMutation({
    mutationFn: async (person: PersonRow) => {
      const { error } = await supabase.rpc("delete_person", { p_person_id: person.id });
      if (error) throw error;
      return person;
    },
    onSuccess: (person) => {
      setMessage({ tone: "success", text: t("people.removed", { name: person.full_name }) });
      void queryClient.invalidateQueries({ queryKey: ["client"] });
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });
  const done = (text: string | null) => {
    setEditing(null);
    if (text) setMessage({ tone: "success", text });
    void queryClient.invalidateQueries({ queryKey: ["client"] });
  };

  return (
    <Card
      title={t("client_details.people_title")}
      actions={
        !readOnly && editing === null && (
          <Button type="button" variant="secondary" onClick={() => setEditing("new")}>
            {t("people.add")}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("client_details.people_intro")}</p>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {people.isPending && <Spinner />}
        {editing === "new" && <PersonForm processId={processId} onDone={done} />}
        <ul className="divide-y divide-line">
          {(people.data ?? []).map((person) =>
            editing === person.id ? (
              <li key={person.id} className="py-3">
                <PersonForm processId={processId} person={person} onDone={done} />
              </li>
            ) : (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-primary">
                    {person.full_name}
                    <Badge>{t(`relationship.${person.relationship}`)}</Badge>
                  </p>
                  <p className="text-sm text-muted">
                    {[person.nationality, person.date_of_birth ? t("people.born_on", { date: format.date(person.date_of_birth) }) : null]
                      .filter(Boolean)
                      .join(" · ") || t("client_details.person_incomplete")}
                  </p>
                </div>
                {!readOnly && editing === null && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => setEditing(person.id)}>
                      {t("actions.edit")}
                    </Button>
                    {person.relationship !== "holder" && (
                      <ConfirmButton
                        variant="link"
                        label={t("actions.remove")}
                        confirmLabel={t("people.remove_confirm")}
                        question={t("client_details.remove_question")}
                        busy={remove.isPending && remove.variables?.id === person.id}
                        onConfirm={() => {
                          setMessage(null);
                          remove.mutate(person);
                        }}
                      />
                    )}
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      </div>
    </Card>
  );
}

interface PersonValues {
  relationship: Relationship;
  full_name: string;
  nationality: string;
  date_of_birth: string;
}

function PersonForm({ processId, person, onDone }: { processId: string; person?: PersonRow; onDone: (message: string | null) => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<PersonValues>({
    defaultValues: {
      relationship: person?.relationship ?? "spouse",
      full_name: person?.full_name ?? "",
      nationality: person?.nationality ?? "",
      date_of_birth: person?.date_of_birth ?? "",
    },
  });
  const save = useMutation({
    mutationFn: async (v: PersonValues) => {
      const { error } = await supabase.rpc("save_person", {
        p_process_id: processId,
        p_person_id: person?.id ?? null,
        p_relationship: person?.relationship === "holder" ? "holder" : v.relationship,
        p_full_name: v.full_name,
        p_nationality: v.nationality,
        p_date_of_birth: v.date_of_birth || null,
      });
      if (error) throw error;
      return v;
    },
    onSuccess: (v) => onDone(person ? t("people.updated", { name: v.full_name }) : t("people.added", { name: v.full_name })),
    onError: (e) => setError(t(errorKey(e))),
  });
  const options = (person?.relationship === "holder" ? (["holder"] as const) : (["spouse", "child", "other"] as const)).map(
    (r) => ({ value: r, label: t(`relationship.${r}`) }),
  );
  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-md border border-line bg-background p-4"
      onSubmit={handleSubmit((v) => {
        setError(null);
        save.mutate(v);
      })}
    >
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_10rem_10rem]">
        <SelectField label={t("fields.relationship")} options={options} disabled={person?.relationship === "holder"} {...register("relationship")} />
        <TextField
          label={t("fields.full_name")}
          autoComplete="off"
          error={formState.errors.full_name?.message}
          {...register("full_name", { validate: (v) => v.trim() !== "" || t("validation.required") })}
        />
        <TextField label={t("fields.nationality")} autoComplete="off" {...register("nationality")} />
        <TextField label={t("fields.date_of_birth")} type="date" {...register("date_of_birth")} />
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
