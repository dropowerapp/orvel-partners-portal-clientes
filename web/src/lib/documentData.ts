import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrg } from "./OrgProvider";
import { supabase } from "./supabase";
import type { DocumentPerson, DocumentRequest, DocumentType, PortalDocument } from "./documents";

export function useDocuments(processId?: string, staff = false) {
  const org = useOrg();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["documents", org.id, processId, staff],
    enabled: !!processId,
    queryFn: async () => {
      const [requests, documents] = await Promise.all([
        supabase.from("document_requests").select("id, process_id, organization_id, person_id, document_type_id, status, custom_label, instructions, rejection_reason, person:people(id, full_name, relationship), document_type:document_types(id, label, direction, is_sensitive, deadline_type)").eq("process_id", processId!).order("created_at"),
        supabase.from("documents").select("id, process_id, request_id, person_id, document_type_id, direction, title, file_name, mime_type, size_bytes, created_at, issued_on, expires_on, purged_at, visible_to_client, is_sensitive, person:people(id, full_name, relationship), document_type:document_types(id, label, direction, is_sensitive, deadline_type)").eq("process_id", processId!).order("created_at", { ascending: false }),
      ]);
      if (requests.error) throw requests.error;
      if (documents.error) throw documents.error;
      return { requests: (requests.data ?? []) as unknown as DocumentRequest[], documents: (documents.data ?? []) as unknown as PortalDocument[] };
    },
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["documents"] }),
      queryClient.invalidateQueries({ queryKey: ["client"] }),
      queryClient.invalidateQueries({ queryKey: ["client-processes"] }),
      queryClient.invalidateQueries({ queryKey: ["team-process", processId] }),
      queryClient.invalidateQueries({ queryKey: ["team-processes"] }),
      queryClient.invalidateQueries({ queryKey: ["team-activity", processId] }),
    ]);
  };
  return { ...query, refresh };
}
export function useDocumentOptions(processId: string) {
  const org = useOrg();
  return useQuery({
    queryKey: ["document-options", org.id, processId],
    queryFn: async () => {
      const [types, people] = await Promise.all([
        supabase.from("document_types").select("id, label, direction, is_sensitive, deadline_type").eq("organization_id", org.id).eq("is_active", true).order("position"),
        supabase.from("people").select("id, full_name, relationship").eq("process_id", processId).order("position"),
      ]);
      if (types.error) throw types.error;
      if (people.error) throw people.error;
      return { types: (types.data ?? []) as DocumentType[], people: (people.data ?? []) as DocumentPerson[] };
    },
  });
}
