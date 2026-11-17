import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { DocumentDownload, DocumentStats, EmptyDocuments, FilePicker, IssuedDocuments, RequestBadge } from "../../../components/DocumentUI";
import { Icon } from "../../../components/Icon";
import { Alert, Button, Card, CheckboxField, SelectField, Spinner, TextAreaField, TextField } from "../../../components/ui";
import { useDocumentOptions, useDocuments } from "../../../lib/documentData";
import { type DocumentRequest, type PortalDocument, documentPath, latestDocument, validateDocumentFile } from "../../../lib/documents";
import { localized } from "../../../lib/client";
import { errorKey } from "../../../lib/errors";
import { supabase } from "../../../lib/supabase";
import { useProcess } from "./ProcessLayout";

export default function ProcessDocuments() {
  const { t } = useTranslation();
  const { process, closed } = useProcess();
  const query = useDocuments(process.id, true);
  const [tab, setTab] = useState<"requests" | "issued">("requests");
  const [form, setForm] = useState<"request" | "issued" | null>(null);
  if (query.isPending) return <Spinner />;
  if (query.isError || !query.data) return <Alert>{t("documents.load_error")} <Button variant="link" onClick={() => void query.refetch()}>{t("documents.retry")}</Button></Alert>;
  const { requests, documents } = query.data;
  const complete = async () => { setForm(null); await query.refresh(); };
  return <div className="flex flex-col gap-6">
    <DocumentStats requests={requests} />
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="inline-flex rounded-xl border border-line bg-white p-1" role="group" aria-label={t("documents.sections")}>
        {(["requests", "issued"] as const).map((value) => <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}
          className={"rounded-lg px-4 py-2 text-sm font-semibold " + (tab === value ? "bg-primary text-white" : "text-muted")}>{t(("documents.tab_" + value))}</button>)}
      </div>
      {!closed && <Button variant="secondary" onClick={() => setForm(tab === "requests" ? "request" : "issued")}><Icon name="plus" className="size-4" />{t(tab === "requests" ? "documents.new_request" : "documents.new_issued")}</Button>}
    </div>
    {form && !closed && <DocumentForm key={process.id + form} kind={form} onComplete={complete} onCancel={() => setForm(null)} />}
    {tab === "requests" ? <Card title={t("documents.team_requests")}>
      {!requests.length && <EmptyDocuments title={t("documents.requests_empty")} body={t("documents.team_empty_body")} />}
      {[...requests].sort((a, b) => (a.status === "submitted" ? -1 : 0) - (b.status === "submitted" ? -1 : 0)).map((request) =>
        <ReviewRow key={request.id} request={request} documents={documents} closed={closed} refresh={query.refresh} />)}
    </Card> : <Card title={t("documents.issued_title")}><IssuedDocuments documents={documents} staff onChange={closed ? undefined : query.refresh} /></Card>}
  </div>;
}

function ReviewRow({ request, documents, closed, refresh }: { request: DocumentRequest; documents: PortalDocument[]; closed: boolean; refresh: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = latestDocument(documents, request.id);
  const history = documents.filter((d) => d.request_id === request.id && d.id !== latest?.id);
  const act = async (status: "approved" | "rejected" | "remove") => {
    if (status === "rejected" && !reason.trim()) { setError("errors.rejection_reason_required"); return; }
    setBusy(true); setError(null);
    try {
      const { error } = status === "remove"
        ? await supabase.rpc("remove_document_request", { p_request_id: request.id })
        : await supabase.rpc("review_document_request", { p_request_id: request.id, p_document_id: latest?.id, p_status: status, p_reason: reason.trim() || null });
      if (error) throw error;
      setRejecting(false); setReason(""); await refresh();
    } catch (e) { setError(errorKey(e)); } finally { setBusy(false); }
  };
  return <article className="document-row py-5 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-1 text-xs text-muted">{request.person?.full_name}</p>
        <h3 className="font-semibold">{request.custom_label || localized(request.document_type?.label ?? {}, i18n.language)}</h3>
        {request.instructions && <p className="mt-2 text-sm whitespace-pre-line text-muted">{request.instructions}</p>}
        {latest && <p className="mt-2 text-xs break-all text-muted">{latest.file_name}</p>}
      </div>
      <RequestBadge status={request.status} />
    </div>
    {request.status === "rejected" && <p className="mt-3 text-sm text-amber-800">{request.rejection_reason}</p>}
    <div className="mt-4 flex flex-wrap items-start gap-2">
      {latest && <DocumentDownload document={latest} />}
      {!closed && latest && request.status === "submitted" && <>
        <Button busy={busy} onClick={() => void act("approved")}><Icon name="check" className="size-4" />{t("documents.approve")}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setRejecting(!rejecting)}>{t("documents.request_correction")}</Button>
      </>}
      {!closed && request.status === "pending" && !documents.some((d) => d.request_id === request.id) &&
        <ConfirmButton label={t("documents.remove_request")} question={t("documents.remove_question")} confirmLabel={t("documents.remove_request")} busy={busy} onConfirm={() => void act("remove")} variant="link" />}
    </div>
    {rejecting && <form className="mt-4 flex flex-col gap-3 rounded-xl bg-background p-4" onSubmit={(e) => { e.preventDefault(); void act("rejected"); }}>
      <TextAreaField label={t("documents.rejection_label")} required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      <p className="text-xs text-muted">{t("documents.rejection_hint")}</p>
      <div className="flex gap-2"><Button type="submit" busy={busy}>{t("documents.confirm_rejection")}</Button><Button type="button" variant="link" onClick={() => setRejecting(false)}>{t("actions.cancel")}</Button></div>
    </form>}
    {history.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted">{t("documents.previous_versions", { count: history.length })}</summary>
      <ul className="mt-3 space-y-3">{history.map((doc) => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3"><span className="break-all">{doc.file_name}</span><DocumentDownload document={doc} /></li>)}</ul>
    </details>}
    {error && <div className="mt-3"><Alert>{t(error)}</Alert></div>}
  </article>;
}

function DocumentForm({ kind, onComplete, onCancel }: { kind: "request" | "issued"; onComplete: () => Promise<void>; onCancel: () => void }) {
  const { t, i18n } = useTranslation();
  const { process } = useProcess();
  const options = useDocumentOptions(process.id);
  const [person, setPerson] = useState("");
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [visible, setVisible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<{ path: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const types = (options.data?.types ?? []).filter((d) => d.direction === (kind === "request" ? "upload" : "issued"));
  const selected = types.find((d) => d.id === type);
  const submit = async () => {
    setError(null);
    if (!type || (kind === "request" && !person)) { setError("errors.document_fields_required"); return; }
    if (kind === "issued" && !file && !receipt) { setError("errors.document_file_required"); return; }
    if (expiresOn && issuedOn && expiresOn < issuedOn) { setError("errors.document_dates_invalid"); return; }
    setBusy(true);
    try {
      if (kind === "request") {
        const { error } = await supabase.rpc("create_document_request", { p_process_id: process.id, p_person_id: person, p_type_id: type, p_label: title.trim() || null, p_instructions: instructions.trim() || null });
        if (error) throw error;
      } else {
        let uploaded = receipt;
        if (!uploaded && file) {
          const path = documentPath(process.organization_id, process.id, file);
          const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
          if (error) throw error;
          uploaded = { path, name: file.name }; setReceipt(uploaded);
        }
        const { error } = await supabase.rpc("register_issued_document", { p_process_id: process.id, p_type_id: type, p_person_id: person || null,
          p_storage_path: uploaded!.path, p_file_name: uploaded!.name, p_title: title.trim() || null, p_issued_on: issuedOn || null, p_expires_on: expiresOn || null, p_visible: visible });
        if (error) throw error;
      }
      await onComplete();
    } catch (e) { setError(errorKey(e)); } finally { setBusy(false); }
  };
  return <Card title={t(kind === "request" ? "documents.new_request" : "documents.new_issued")} actions={<Button variant="link" disabled={busy} onClick={onCancel}>{t("actions.cancel")}</Button>}>
    {options.isPending ? <Spinner /> : options.isError ? <Alert>{t("documents.load_error")}</Alert> :
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex flex-col gap-5">
        <fieldset disabled={busy || !!receipt} className="grid gap-5 sm:grid-cols-2">
          <SelectField label={t("documents.type")} value={type} onChange={(e) => setType(e.target.value)} required options={[{ value: "", label: t("documents.select_type") }, ...types.map((d) => ({ value: d.id, label: localized(d.label, i18n.language) }))]} />
          <SelectField label={t("documents.person")} value={person} onChange={(e) => setPerson(e.target.value)} required={kind === "request"} options={[{ value: "", label: t(kind === "request" ? "documents.select_person" : "documents.company_document") }, ...(options.data?.people ?? []).map((person) => ({ value: person.id, label: person.full_name }))]} />
          <TextField label={t("documents.custom_title")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="sm:col-span-2" />
          {kind === "request" ? <TextAreaField label={t("documents.instructions")} value={instructions} maxLength={2000} onChange={(e) => setInstructions(e.target.value)} className="sm:col-span-2" /> : <>
            <TextField label={t("documents.issued_on")} type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
            <TextField label={t("documents.expires_on")} type="date" value={expiresOn} min={issuedOn || undefined} onChange={(e) => setExpiresOn(e.target.value)} hint={selected?.deadline_type ? t("documents.deadline_hint") : undefined} />
            <CheckboxField checked={visible} onChange={(e) => setVisible(e.target.checked)} label={t("documents.visible_label")} hint={t("documents.visible_hint")} className="sm:col-span-2" />
          </>}
        </fieldset>
        {kind === "issued" && !receipt && <><FilePicker busy={busy} onFile={(chosen) => {
          const issue = validateDocumentFile(chosen); setError(issue ? "errors." + issue : null); setFile(issue ? null : chosen);
        }} />{file && <p className="break-all text-sm text-muted">{file.name}</p>}</>}
        {receipt && <Alert tone="info">{t("documents.registration_pending")}</Alert>}
        {error && <Alert>{t(error)}</Alert>}
        <div><Button type="submit" busy={busy}>{t(receipt ? "documents.retry_registration" : kind === "request" ? "documents.create_request" : "documents.save_issued")}</Button></div>
      </form>}
  </Card>;
}
