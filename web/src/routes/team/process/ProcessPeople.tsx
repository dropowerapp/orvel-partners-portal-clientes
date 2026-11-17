// Ficha · Pessoas e dados: titular, cônjuge, filhos e outros. Cada pessoa nova recebe os pedidos de
// documentos do modelo da organização (trigger da base de dados).
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { Alert, Badge, Button, Card, SelectField, Spinner, TextField } from "../../../components/ui";
import { errorKey } from "../../../lib/errors";
import { supabase } from "../../../lib/supabase";
import type { Relationship } from "../../../lib/team";
import { useFormat } from "../../../lib/teamData";
import { useProcess } from "./ProcessLayout";

interface PersonRow {
  id: string;
  relationship: Relationship;
  full_name: string;
  nationality: string | null;
  date_of_birth: string | null;
  position: number;
  document_requests: { status: string }[];
}

interface PersonValues {
  relationship: Relationship;
  full_name: string;
  nationality: string;
  date_of_birth: string;
}

export default function ProcessPeople() {
  const { t } = useTranslation();
  const format = useFormat();
  const { process, closed, refresh } = useProcess();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const people = useQuery({
    queryKey: ["team-people", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("id, relationship, full_name, nationality, date_of_birth, position, document_requests(status)")
        .eq("process_id", process.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (person: PersonRow) => {
      const { error } = await supabase.from("people").delete().eq("id", person.id);
      if (error) throw error;
      return person;
    },
    onSuccess: async (person) => {
      setMessage({ tone: "success", text: t("people.removed", { name: person.full_name }) });
      await people.refetch();
      await refresh();
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });

  const rows = people.data ?? [];
  const nextPosition = rows.reduce((max, p) => Math.max(max, p.position), 0) + 1;

  return (
    <Card
      title={t("people.title")}
      actions={
        !closed && editing === null && (
          <Button type="button" variant="secondary" onClick={() => setEditing("new")}>
            {t("people.add")}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("people.intro")}</p>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {people.isPending && <Spinner />}
        {people.isError && <Alert>{t("people.load_error")}</Alert>}
        {editing === "new" && (
          <PersonForm
            processId={process.id}
            organizationId={process.organization_id}
            position={nextPosition}
            onDone={async (text) => {
              setEditing(null);
              if (text) setMessage({ tone: "success", text });
              await people.refetch();
              await refresh();
            }}
          />
        )}
        <ul className="divide-y divide-line">
          {rows.map((person) => {
            const pending = person.document_requests.filter((r) => r.status !== "approved").length;
            if (editing === person.id) {
              return (
                <li key={person.id} className="py-3">
                  <PersonForm
                    person={person}
                    processId={process.id}
                    organizationId={process.organization_id}
                    position={person.position}
                    onDone={async (text) => {
                      setEditing(null);
                      if (text) setMessage({ tone: "success", text });
                      await people.refetch();
                    }}
                  />
                </li>
              );
            }
            return (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-primary">
                    {person.full_name}
                    <Badge>{t(`relationship.${person.relationship}`)}</Badge>
                  </p>
                  <p className="text-sm text-muted">
                    {[
                      person.nationality,
                      person.date_of_birth ? t("people.born_on", { date: format.date(person.date_of_birth) }) : null,
                      t("people.requests", { pending, total: person.document_requests.length }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {!closed && editing === null && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => setEditing(person.id)}>
                      {t("actions.edit")}
                    </Button>
                    {person.relationship !== "holder" && (
                      <ConfirmButton
                        label={t("actions.remove")}
                        confirmLabel={t("people.remove_confirm")}
                        question={t("people.remove_question")}
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
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

function PersonForm({
  person,
  processId,
  organizationId,
  position,
  onDone,
}: {
  person?: PersonRow;
  processId: string;
  organizationId: string;
  position: number;
  onDone: (message: string | null) => void;
}) {
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
    mutationFn: async (values: PersonValues) => {
      const row = {
        full_name: values.full_name.trim(),
        nationality: values.nationality.trim() || null,
        date_of_birth: values.date_of_birth || null,
      };
      const { error } = person
        ? await supabase
          .from("people")
          .update({ ...row, ...(person.relationship === "holder" ? {} : { relationship: values.relationship }) })
          .eq("id", person.id)
        : await supabase
          .from("people")
          .insert({ ...row, relationship: values.relationship, organization_id: organizationId, process_id: processId, position });
      if (error) throw error;
      return values;
    },
    onSuccess: (values) =>
      onDone(person ? t("people.updated", { name: values.full_name }) : t("people.added", { name: values.full_name })),
    onError: (e) => setError(t(errorKey(e))),
  });

  const options = (person?.relationship === "holder" ? (["holder"] as const) : (["spouse", "child", "other"] as const)).map(
    (r) => ({ value: r, label: t(`relationship.${r}`) }),
  );

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
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_10rem_10rem]">
        <SelectField label={t("fields.relationship")} options={options} disabled={person?.relationship === "holder"} {...register("relationship")} />
        <TextField
          label={t("fields.full_name")}
          autoComplete="off"
          error={formState.errors.full_name?.message}
          {...register("full_name", { required: t("validation.required") })}
        />
        <TextField label={t("fields.nationality")} autoComplete="off" {...register("nationality")} />
        <TextField label={t("fields.date_of_birth")} type="date" {...register("date_of_birth")} />
      </div>
      {!person && <p className="text-sm text-muted">{t("people.new_hint")}</p>}
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
