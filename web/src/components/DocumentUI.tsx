import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ACCEPTED_FILES, type DocumentRequest, type PortalDocument, type RequestStatus, documentCounts, fileSize } from "../lib/documents";
import { localized } from "../lib/client";
import { errorKey } from "../lib/errors";
import { supabase } from "../lib/supabase";
import { openDownload } from "../lib/download";
import { useFormat } from "../lib/teamData";
import { Alert, Badge, type BadgeTone, Button } from "./ui";
import { Icon } from "./Icon";

const tones: Record<RequestStatus, BadgeTone> = { pending: "neutral", submitted: "info", approved: "success", rejected: "warning" };
export function RequestBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation();
  return <Badge tone={tones[status]}>{t(("documents.status." + status))}</Badge>;
}
export function DocumentStats({ requests }: { requests: DocumentRequest[] }) {
  const { t } = useTranslation();
  const counts = documentCounts(requests);
  return <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
    {(["pending", "submitted", "approved", "rejected"] as const).map((status) => (
      <div key={status} className="portal-card flex items-center justify-between gap-2 px-5 py-4">
        <span className="text-sm text-muted">{t(("documents.stats." + status))}</span>
        <span className={"text-2xl font-light tabular-nums " + (status === "rejected" && counts[status] ? "text-amber-800" : "text-primary")}>{counts[status]}</span>
      </div>
    ))}
  </div>;
}
export function FilePicker({ busy, onFile, label }: { busy: boolean; onFile: (file: File) => void; label?: string }) {
  const { t } = useTranslation();
  const id = useId();
  const [dragging, setDragging] = useState(false);
  return <div className={"upload-zone " + (dragging ? "is-dragging" : "")}
    onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
    onDragLeave={() => setDragging(false)}
    onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
    <Icon name="upload" className="size-6 text-wordmark" />
    <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-action">{busy ? t("documents.uploading") : label ?? t("documents.choose_file")}</label>
    <input id={id} type="file" accept={ACCEPTED_FILES} disabled={busy} className="sr-only" onChange={(e) => {
      const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = "";
    }} />
    <span className="text-xs text-muted">{t("documents.file_hint")}</span>
  </div>;
}
export function DocumentDownload({ document }: { document: PortalDocument }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return <div className="flex flex-col items-start gap-2">
    <Button variant="secondary" busy={busy} disabled={!!document.purged_at} onClick={async () => {
      setBusy(true); setError(null);
      try { setError(await openDownload("document", document.id)); } catch { setError("network"); } finally { setBusy(false); }
    }}><Icon name="download" className="size-4" />{t(document.purged_at ? "documents.purged" : "documents.download")}</Button>
    {error && <Alert>{t("errors." + error)}</Alert>}
  </div>;
}
export function IssuedDocuments({ documents, staff = false, onChange }: { documents: PortalDocument[]; staff?: boolean; onChange?: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const issued = documents.filter((d) => d.direction === "issued");
  if (!issued.length) return <EmptyDocuments title={t("documents.issued_empty")} body={t("documents.issued_empty_body")} />;
  return <ul className="divide-y divide-line">
    {issued.map((doc) => <li key={doc.id} className="flex flex-col justify-between gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background text-primary-deep"><Icon name="files" /></span>
        <div className="min-w-0">
          <p className="font-semibold break-words">{doc.title || localized(doc.document_type?.label ?? {}, i18n.language)}</p>
          <p className="mt-1 text-xs break-all text-muted">{doc.file_name} · {fileSize(doc.size_bytes, i18n.language)}</p>
          <p className="mt-1 text-xs text-muted">{doc.person?.full_name ?? t("documents.company_document")}{doc.expires_on && " · " + t("documents.expires", { date: format.date(doc.expires_on) })}</p>
          {staff && <span className="mt-2 inline-block"><Badge>{t(doc.visible_to_client ? "documents.visible" : "documents.internal")}</Badge></span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2"><DocumentDownload document={doc} />
        {staff && onChange && !doc.purged_at && <DocumentVisibility document={doc} onChange={onChange} />}
      </div>
    </li>)}
  </ul>;
}
export function EmptyDocuments({ title, body }: { title: string; body: string }) {
  return <div className="flex flex-col items-center py-9 text-center">
    <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-background text-wordmark"><Icon name="files" className="size-7" /></span>
    <p className="font-semibold text-primary">{title}</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
  </div>;
}


function DocumentVisibility({ document, onChange }: { document: PortalDocument; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div className="flex flex-col gap-2"><Button variant="link" busy={busy} onClick={async () => {
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.rpc("set_document_visibility", { p_document_id: document.id, p_visible: !document.visible_to_client });
      if (error) throw error;
      await onChange();
    } catch (e) { setError(errorKey(e)); } finally { setBusy(false); }
  }}>{t(document.visible_to_client ? "documents.make_internal" : "documents.make_visible")}</Button>
    {error && <Alert>{t(error)}</Alert>}
  </div>;
}
