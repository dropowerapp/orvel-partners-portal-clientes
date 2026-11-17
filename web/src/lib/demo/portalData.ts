// Conteúdo fictício e só de leitura para rever o portal sem serviços externos.
import type { DemoClientRow } from "./data";
type Row = Record<string, unknown>;
export function portalRows(table: string, client: DemoClientRow): Row[] {
  const org = client.organization_id;
  const processId = "demo-process-" + client.id;
  const person = { id: processId + "-holder", full_name: client.full_name, relationship: "holder", organization_id: org, process_id: processId, nationality: "Portuguesa", date_of_birth: null, position: 0 };
  const companion = { ...person, id: processId + "-spouse", full_name: "Alex Exemplo", relationship: "spouse", position: 1 };
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const stamp = (offset: number) => day(offset) + "T10:00:00Z";
  const label = (value: string) => ({ "pt-PT": value });
  const type = (key: string, name: string, direction: "upload" | "issued", sensitive = false) => ({
    id: org + "-" + key, organization_id: org, label: label(name), key, direction, is_sensitive: sensitive, deadline_type: null, is_active: true, position: 0,
  });
  const types = [type("passport", "Passaporte", "upload", true), type("photo", "Fotografia", "upload", true), type("certificate", "Certidão de casamento", "upload"), type("invoice", "Fatura", "issued")];
  const request = (index: number, who: typeof person, status: string) => ({
    id: processId + "-request-" + index, process_id: processId, organization_id: org, person_id: who.id, document_type_id: types[index % 3].id,
    custom_label: null, instructions: index % 3 === 0 ? "Envie uma cópia a cores, com todos os dados legíveis." : null,
    status, rejection_reason: status === "rejected" ? "A fotografia está desfocada. Envie uma nova imagem, de frente e com fundo branco." : null,
    person: who, document_type: types[index % 3], created_at: stamp(-10),
  });
  const requests = [request(0, person, "approved"), request(1, person, "rejected"), request(2, person, "submitted"), request(3, companion, "pending"), request(4, companion, "pending")];
  const documents = requests.filter((r) => r.status !== "pending").map((r, index) => ({
    id: processId + "-doc-" + index, organization_id: org, process_id: processId, person_id: r.person_id, request_id: r.id,
    document_type_id: r.document_type_id, direction: "upload", title: null, file_name: index === 0 ? "passaporte-exemplo.pdf" : index === 1 ? "fotografia-exemplo.jpg" : "certidao-exemplo.pdf",
    mime_type: index === 1 ? "image/jpeg" : "application/pdf", size_bytes: 350000, storage_path: "demo",
    is_sensitive: r.document_type.is_sensitive, visible_to_client: true, purged_at: null, issued_on: null, expires_on: null,
    created_at: stamp(-2), document_type: r.document_type, person: r.person,
  }));
  const issued = {
    ...documents[0], id: processId + "-invoice", request_id: null, person_id: null, person: null,
    document_type_id: types[3].id, document_type: types[3], direction: "issued", is_sensitive: false,
    title: "Fatura de serviços", file_name: "fatura-exemplo.pdf", issued_on: day(-8),
  };
  const payments = [
    { id: processId + "-payment-1", process_id: processId, description: "Constituição da empresa", amount_aed: 18000, amount_paid_aed: 18000, status: "paid", due_on: day(-8), paid_on: day(-8) },
    { id: processId + "-payment-2", process_id: processId, description: "Visto de residência", amount_aed: 6500, amount_paid_aed: 0, status: "pending", due_on: day(7), paid_on: null },
  ];
  const steps = [
    ["documents", "Proposta aceite", "done"], ["documents", "Pagamento inicial recebido", "done"],
    ["documents", "Reunir e validar documentos", "in_progress"], ["incorporation", "Constituição da empresa", "todo"],
    ["residence", "Visto de residência e Emirates ID", "todo"], ["bank", "Abertura de conta bancária", "todo"],
  ].map(([phase, title, status], i) => ({ id: processId + "-step-" + i, organization_id: org, process_id: processId, position: i + 1, phase, title: label(title), status, planned_on: day(i * 5), done_on: i < 2 ? day(-8) : null, client_note: i === 2 ? "Assim que todos os documentos estiverem aprovados, avançamos para a constituição." : null }));
  const fullClient = { ...client, phone: "+351 900 000 000", country: "Portugal", address_line: "", city: "", postal_code: "", address_country: "Portugal", locale: "pt-PT" };
  const process = {
    id: processId, organization_id: org, client_id: client.id, client: fullClient, status: "awaiting_documents", plan_name: "Business Setup",
    includes_bank_account: true, free_zone: "Meydan", visa_count: 1, company_name_options: ["Example Consulting", "Example Ventures"],
    bank_account_id: null, bank_details_released_at: null, completed_at: null, cancelled_at: null, created_at: stamp(-12),
    payments, document_requests: requests, deadlines: [],
  };
  const tables: Record<string, Row[]> = {
    processes: [process], people: [person, companion], document_requests: requests, documents: [...documents, issued],
    document_types: types, payments, timeline_steps: steps, deadlines: [],
    proposals: [{ id: processId + "-proposal", process_id: processId, reference: "ORV-2026-024", pdf_path: null, plans: [{ name: "Business Setup", price_aed: 24500, includes_bank_account: true }], chosen_plan: "Business Setup", status: "accepted", valid_until: day(15), sent_at: stamp(-12), accepted_at: stamp(-10), accepted_text: "Exemplo de aceitação de proposta." }],
    organizations: [{ id: org, timezone: "Asia/Dubai", proposal_ref_prefix: "ORV", default_locale: "pt-PT" }],
  };
  return tables[table] ?? [];
}
