import { describe, expect, it } from "vitest";
import { documentCounts, documentPath, FILE_LIMIT, latestDocument, type PortalDocument, validateDocumentFile } from "./documents";

describe("documentos", () => {
  it("aceita PDF/JPG/PNG até 10 MB e recusa vazios, tipos incorretos e ficheiros maiores", () => {
    for (const type of ["application/pdf", "image/jpeg", "image/png"]) expect(validateDocumentFile({ type, size: FILE_LIMIT })).toBeNull();
    expect(validateDocumentFile({ type: "text/html", size: 100 })).toBe("document_file_type");
    expect(validateDocumentFile({ type: "application/pdf", size: 0 })).toBe("document_file_empty");
    expect(validateDocumentFile({ type: "application/pdf", size: FILE_LIMIT + 1 })).toBe("document_file_size");
  });
  it("o caminho usa identificadores e não o nome do ficheiro do utilizador", () => {
    const path = documentPath("org", "process", { type: "image/jpeg" }, "request");
    expect(path).toMatch(/^org\/process\/uploads\/request\/[a-f0-9-]+\.jpg$/);
    expect(documentPath("org", "process", { type: "application/pdf" })).toMatch(/^org\/process\/issued\/[a-f0-9-]+\.pdf$/);
  });
  it("conta rejeitados separadamente de pedidos ainda por enviar", () => {
    expect(documentCounts([{ status: "rejected" }, { status: "pending" }, { status: "approved" }, { status: "submitted" }]))
      .toEqual({ rejected: 1, pending: 1, approved: 1, submitted: 1 });
  });
  it("a revisão seleciona a versão mais recente disponível, sem misturar pedidos", () => {
    const docs = [
      { id: "old", request_id: "r", created_at: "2026-11-01", purged_at: null },
      { id: "new", request_id: "r", created_at: "2026-11-02", purged_at: null },
      { id: "purged", request_id: "r", created_at: "2026-11-03", purged_at: "2026-11-04" },
      { id: "other", request_id: "other", created_at: "2026-11-05", purged_at: null },
    ] as PortalDocument[];
    expect(latestDocument(docs, "r")?.id).toBe("new");
    expect(latestDocument(docs, "missing")).toBeUndefined();
  });
});
