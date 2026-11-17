// Ficha · Interno (só equipa; o cliente e o parceiro nunca veem): responsável, parceiro, custos,
// preço de venda, margem, entidade que emite a fatura e notas internas.
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { Alert, Button, Card, DataList, SelectField, Spinner, TextAreaField, TextField } from "../../../components/ui";
import { errorKey } from "../../../lib/errors";
import { useOrg } from "../../../lib/OrgProvider";
import { supabase } from "../../../lib/supabase";
import { marginOf, type OtherCost } from "../../../lib/team";
import { useFormat, useStaffNames } from "../../../lib/teamData";
import { useProcess } from "./ProcessLayout";

interface InternalRow {
  manager_user_id: string | null;
  partner_id: string | null;
  partner_cost_aed: number | null;
  other_costs: OtherCost[];
  sale_price_aed: number | null;
  margin_aed: number | null;
  invoice_issuer: string | null;
}

interface InternalValues {
  manager_user_id: string;
  partner_id: string;
  partner_cost_aed: string;
  sale_price_aed: string;
  invoice_issuer: string;
  other_costs: { label: string; amount_aed: string }[];
}

type Message = { tone: "success" | "error"; text: string } | null;

const toNumber = (value: string) => (value.trim() === "" ? null : Number(value));

export default function ProcessInternal() {
  const { t } = useTranslation();
  const { process } = useProcess();
  const internal = useQuery({
    queryKey: ["team-internal", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_internal")
        .select("manager_user_id, partner_id, partner_cost_aed, other_costs, sale_price_aed, margin_aed, invoice_issuer")
        .eq("process_id", process.id)
        .maybeSingle();
      if (error) throw error;
      return data as InternalRow | null;
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info">{t("internal.private_notice")}</Alert>
      {internal.isPending && <Spinner />}
      {internal.isError && <Alert>{t("internal.load_error")}</Alert>}
      {internal.isSuccess && (
        <InternalForm key={JSON.stringify(internal.data)} data={internal.data} onSaved={() => void internal.refetch()} />
      )}
      <NotesCard />
    </div>
  );
}

function InternalForm({ data, onSaved }: { data: InternalRow | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const org = useOrg();
  const format = useFormat();
  const staff = useStaffNames();
  const { process, closed } = useProcess();
  const [message, setMessage] = useState<Message>(null);

  const partners = useQuery({
    queryKey: ["team-partners", org.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id, name").eq("organization_id", org.id).order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { register, control, handleSubmit, watch, formState, reset } = useForm<InternalValues>({
    defaultValues: {
      manager_user_id: data?.manager_user_id ?? "",
      partner_id: data?.partner_id ?? "",
      partner_cost_aed: data?.partner_cost_aed === null || data?.partner_cost_aed === undefined ? "" : String(data.partner_cost_aed),
      sale_price_aed: data?.sale_price_aed === null || data?.sale_price_aed === undefined ? "" : String(data.sale_price_aed),
      invoice_issuer: data?.invoice_issuer ?? "",
      other_costs: (data?.other_costs ?? []).map((c) => ({ label: c.label, amount_aed: String(c.amount_aed) })),
    },
  });
  const costs = useFieldArray({ control, name: "other_costs" });
  const values = watch();
  const preview = marginOf(
    toNumber(values.sale_price_aed),
    toNumber(values.partner_cost_aed),
    values.other_costs.map((c) => ({ label: c.label, amount_aed: Number(c.amount_aed) || 0 })),
  );

  const save = useMutation({
    mutationFn: async (v: InternalValues) => {
      const otherCosts = v.other_costs
        .filter((c) => c.label.trim() || c.amount_aed.trim())
        .map((c) => ({ label: c.label.trim(), amount_aed: Number(c.amount_aed) || 0 }));
      if (otherCosts.some((c) => c.amount_aed < 0) || [toNumber(v.partner_cost_aed), toNumber(v.sale_price_aed)].some((n) => n !== null && (Number.isNaN(n) || n < 0))) {
        throw new Error("internal.errors.amount");
      }
      const row = {
        manager_user_id: v.manager_user_id || null,
        partner_id: v.partner_id || null,
        partner_cost_aed: toNumber(v.partner_cost_aed),
        sale_price_aed: toNumber(v.sale_price_aed),
        invoice_issuer: v.invoice_issuer.trim() || null,
        other_costs: otherCosts,
      };
      const { error } = data
        ? await supabase.from("process_internal").update(row).eq("process_id", process.id)
        : await supabase.from("process_internal").insert({ ...row, process_id: process.id, organization_id: org.id });
      if (error) throw error;
      return v;
    },
    onSuccess: (v) => {
      reset(v);
      setMessage({ tone: "success", text: t("internal.saved") });
      onSaved();
    },
    onError: (e) => setMessage({ tone: "error", text: e.message.startsWith("internal.errors.") ? t(e.message) : t(errorKey(e)) }),
  });

  const staffOptions = [
    { value: "", label: t("internal.none") },
    ...staff.list.map((m) => ({ value: m.user_id, label: m.display_name || t("internal.unnamed") })),
  ];
  const partnerOptions = [{ value: "", label: t("internal.none") }, ...(partners.data ?? []).map((p) => ({ value: p.id, label: p.name }))];

  return (
    <Card title={t("internal.title")}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) => {
          setMessage(null);
          save.mutate(v);
        })}
      >
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <fieldset disabled={closed} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={t("internal.manager")} options={staffOptions} {...register("manager_user_id")} />
            <SelectField label={t("internal.partner")} options={partnerOptions} {...register("partner_id")} />
            <TextField label={t("internal.partner_cost")} type="number" min={0} step="0.01" inputMode="decimal" {...register("partner_cost_aed")} />
            <TextField label={t("internal.sale_price")} type="number" min={0} step="0.01" inputMode="decimal" {...register("sale_price_aed")} />
            <TextField label={t("internal.invoice_issuer")} className="sm:col-span-2" {...register("invoice_issuer")} />
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-primary">{t("internal.other_costs")}</p>
            {costs.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                <TextField label={t("internal.cost_label")} {...register(`other_costs.${index}.label`)} />
                <TextField label={t("internal.cost_amount")} type="number" min={0} step="0.01" inputMode="decimal" {...register(`other_costs.${index}.amount_aed`)} />
                <Button type="button" variant="link" className="sm:pb-3" onClick={() => costs.remove(index)}>
                  {t("actions.remove")}
                </Button>
              </div>
            ))}
            <div>
              <Button type="button" variant="secondary" onClick={() => costs.append({ label: "", amount_aed: "" })}>
                {t("internal.add_cost")}
              </Button>
            </div>
          </div>
        </fieldset>
        <DataList
          items={[
            { label: t("internal.margin"), value: format.aed(preview) },
            { label: t("internal.margin_saved"), value: format.aed(data?.margin_aed) },
          ]}
        />
        {!closed && (
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

interface NoteRow {
  id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

function NotesCard() {
  const { t } = useTranslation();
  const org = useOrg();
  const format = useFormat();
  const staff = useStaffNames();
  const { process } = useProcess();
  const [message, setMessage] = useState<Message>(null);
  const { register, handleSubmit, reset, formState } = useForm<{ body: string }>({ defaultValues: { body: "" } });

  const notes = useQuery({
    queryKey: ["team-notes", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_notes")
        .select("id, author_id, body, created_at")
        .eq("process_id", process.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },
  });

  const add = useMutation({
    mutationFn: async ({ body }: { body: string }) => {
      const { error } = await supabase.from("internal_notes").insert({ organization_id: org.id, process_id: process.id, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: async () => {
      reset({ body: "" });
      setMessage(null);
      await notes.refetch();
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });

  const remove = useMutation({
    mutationFn: async (note: NoteRow) => {
      const { error } = await supabase.from("internal_notes").delete().eq("id", note.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage({ tone: "success", text: t("internal.note_removed") });
      await notes.refetch();
    },
    onError: (e) => setMessage({ tone: "error", text: t(errorKey(e)) }),
  });

  return (
    <Card title={t("internal.notes_title")}>
      <div className="flex flex-col gap-4">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <form noValidate className="flex flex-col gap-3" onSubmit={handleSubmit((v) => add.mutate(v))}>
          <TextAreaField
            label={t("internal.new_note")}
            error={formState.errors.body?.message}
            {...register("body", { validate: (v) => v.trim() !== "" || t("validation.required") })}
          />
          <div>
            <Button type="submit" variant="secondary" busy={add.isPending}>
              {t("internal.add_note")}
            </Button>
          </div>
        </form>
        {notes.isPending && <Spinner />}
        {notes.isSuccess && notes.data.length === 0 && <p className="text-sm text-muted">{t("internal.no_notes")}</p>}
        <ul className="divide-y divide-line">
          {(notes.data ?? []).map((note) => (
            <li key={note.id} className="py-3">
              <p className="text-sm whitespace-pre-line text-primary">{note.body}</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {[staff.nameOf(note.author_id) ?? t("internal.unnamed"), format.dateTime(note.created_at)].join(" · ")}
                </p>
                <ConfirmButton
                  variant="link"
                  label={t("actions.remove")}
                  confirmLabel={t("internal.note_remove_confirm")}
                  question={t("internal.note_remove_question")}
                  busy={remove.isPending && remove.variables?.id === note.id}
                  onConfirm={() => remove.mutate(note)}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
