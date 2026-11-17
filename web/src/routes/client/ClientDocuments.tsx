import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DocumentDownload, DocumentStats, EmptyDocuments, FilePicker, IssuedDocuments, RequestBadge } from "../../components/DocumentUI";
import { Alert, Button, Card, PageTitle, Spinner } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { useClientProcesses } from "../../lib/clientData";
import { useDocuments } from "../../lib/documentData";
import { type DocumentRequest, type PortalDocument, documentPath, latestDocument, validateDocumentFile } from "../../lib/documents";
import { localized } from "../../lib/client";
import { errorKey } from "../../lib/errors";
import { supabase } from "../../lib/supabase";

export default function ClientDocuments() {
  const { t } = useTranslation();
  const { current, query: processes } = useClientProcesses();
  const query = useDocuments(current?.id);
  const [filter, setFilter] = useState("all");
  if (processes.isPending) return <Spinner />;
  if (processes.isError) return <Alert>{t("documents.load_error")}</Alert>;
  if (!current) return <EmptyDocuments title={t("documents.no_process")} body={t("client_home.no_process")} />;
  if (query.isPending) return <Spinner />;
  if (query.isError || !query.data) return <Alert>{t("documents.load_error")} <Button variant="link" onClick={() => void query.refetch()}>{t("documents.retry")}</Button></Alert>;
  const { requests, documents } = query.data;
  const filtered = requests.filter((r) => filter === "all" || (filter === "action" ? ["pending", "rejected"].includes(r.status) : r.status === filter));
  const groups = new Map<string, DocumentRequest[]>();
  for (const request of filtered) groups.set(request.person_id, [...(groups.get(request.person_id) ?? []), request]);
  const closed = !!current.completed_at || !!current.cancelled_at;
  return <>
    <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={t("documents.title")}>{t("documents.subtitle")}</PageTitle>
    <DocumentStats requests={requests} />
    {closed && <div className="mb-6"><Alert tone="info">{t("process.closed_notice")}</Alert></div>}
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t("documents.filter_label")}>
      {["all", "action", "submitted", "approved"].map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
        className={"rounded-full border px-4 py-2 text-sm transition-colors " + (filter === value ? "border-primary bg-primary text-white" : "border-line bg-white text-muted hover:text-primary")}>{t(("documents.filters." + value))}</button>)}
    </div>
    <div className="flex flex-col gap-6">
      {[...groups].map(([id, rows]) => <Card key={id} title={rows[0].person?.full_name ?? t("documents.person")} actions={<span className="text-xs text-muted">{t("documents.request_count", { count: rows.length })}</span>}>
        {rows.map((request) => <ClientRequestRow key={current.id + request.id} request={request} documents={documents} closed={closed} onComplete={query.refresh} />)}
      </Card>)}
      {!filtered.length && <Card><EmptyDocuments title={t("documents.requests_empty")} body={t(filter === "all" ? "documents.requests_empty_body" : "documents.filter_empty_body")} /></Card>}
      <Card title={t("documents.issued_title")}><IssuedDocuments documents={documents} /></Card>
      <p className="flex items-center gap-2 text-xs text-muted"><Icon name="shield" className="size-4 shrink-0" />{t("documents.privacy_note")}</p>
    </div>
  </>;
}

function ClientRequestRow({ request, documents, closed, onComplete }: { request: DocumentRequest; documents: PortalDocument[]; closed: boolean; onComplete: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ path: string; name: string } | null>(null);
  const latest = latestDocument(documents, request.id);
  const canUpload = !closed && ["pending", "rejected"].includes(request.status);
  const register = async (uploaded: { path: string; name: string }) => {
    const { error } = await supabase.rpc("register_upload", { p_request_id: request.id, p_storage_path: uploaded.path, p_file_name: uploaded.name });
    if (error) throw error;
    setReceipt(null);
    await onComplete();
  };
  const send = async (file?: File) => {
    setError(null);
    if (file) { const issue = validateDocumentFile(file); if (issue) { setError("errors." + issue); return; } }
    setBusy(true);
    try {
      let uploaded = receipt;
      if (file) {
        const path = documentPath(request.organization_id, request.process_id, file, request.id);
        const result = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
        if (result.error) throw result.error;
        uploaded = { path, name: file.name }; setReceipt(uploaded);
      }
      if (uploaded) await register(uploaded);
    } catch (e) { setError(errorKey(e)); } finally { setBusy(false); }
  };
  return <article className="document-row py-5 first:pt-0 last:pb-0">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold">{request.custom_label || localized(request.document_type?.label ?? {}, i18n.language)}</h3>
        {request.instructions && <p className="mt-1 max-w-prose text-sm whitespace-pre-line text-muted">{request.instructions}</p>}
      </div>
      <RequestBadge status={request.status} />
    </div>
    {request.status === "rejected" && <div className="mb-4"><Alert tone="info"><strong>{t("documents.rejection_title")}</strong><p className="mt-1 whitespace-pre-line">{request.rejection_reason}</p></Alert></div>}
    {latest && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background px-4 py-3"><span className="min-w-0 break-all text-sm text-muted">{latest.file_name}</span><DocumentDownload document={latest} /></div>}
    {error && <div className="mb-3"><Alert>{t(error)}</Alert></div>}
    {canUpload && (receipt ? <div className="flex flex-col gap-3"><Alert tone="info">{t("documents.registration_pending")}</Alert><Button busy={busy} onClick={() => void send()}>{t("documents.retry_registration")}</Button></div>
      : <FilePicker busy={busy} onFile={(file) => void send(file)} label={t(request.status === "rejected" ? "documents.replace_file" : "documents.choose_file")} />)}
    {request.status === "submitted" && <p className="text-sm text-muted">{t("documents.under_review")}</p>}
  </article>;
}
