export type RequestStatus = "pending" | "submitted" | "approved" | "rejected";
export interface DocumentType { id: string; label: Record<string, string>; direction: "upload" | "issued"; is_sensitive: boolean; deadline_type: string | null }
export interface DocumentPerson { id: string; full_name: string; relationship: string }
export interface DocumentRequest {
  id: string; process_id: string; organization_id: string; person_id: string; document_type_id: string;
  status: RequestStatus; custom_label: string | null; instructions: string | null; rejection_reason: string | null;
  person: DocumentPerson; document_type: DocumentType;
}
export interface PortalDocument {
  id: string; process_id: string; request_id: string | null; person_id: string | null; document_type_id: string;
  direction: "upload" | "issued"; title: string | null; file_name: string; mime_type: string; size_bytes: number;
  created_at: string; issued_on: string | null; expires_on: string | null; purged_at: string | null;
  visible_to_client: boolean; is_sensitive: boolean; document_type: DocumentType; person: DocumentPerson | null;
}
export const FILE_LIMIT = 10 * 1024 * 1024;
export const ACCEPTED_FILES = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
export function validateDocumentFile(file: Pick<File, "size" | "type">): string | null {
  if (!extensions[file.type]) return "document_file_type";
  if (file.size === 0) return "document_file_empty";
  if (file.size > FILE_LIMIT) return "document_file_size";
  return null;
}
export function documentPath(org: string, process: string, file: Pick<File, "type">, requestId?: string) {
  return [org, process, ...(requestId ? ["uploads", requestId] : ["issued"]), crypto.randomUUID() + "." + extensions[file.type]].join("/");
}
export function documentCounts(requests: Pick<DocumentRequest, "status">[]) {
  return requests.reduce((counts, r) => { counts[r.status]++; return counts; }, { pending: 0, submitted: 0, approved: 0, rejected: 0 });
}
export function latestDocument(documents: PortalDocument[], requestId: string) {
  return documents.filter((d) => d.request_id === requestId && !d.purged_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0];
}
export function fileSize(bytes: number, locale = "pt-PT") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (bytes >= 1048576 ? 1048576 : 1024)) + (bytes >= 1048576 ? " MB" : " KB");
}
