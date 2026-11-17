import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "../../test/fixtures";
import ClientDocuments from "./ClientDocuments";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(), rpc: vi.fn(), refresh: vi.fn(), current: { id: "process", completed_at: null as string | null, cancelled_at: null },
  request: {
    id: "request", process_id: "process", organization_id: "org", person_id: "person", status: "pending",
    custom_label: null, instructions: null, rejection_reason: null, person: { id: "person", full_name: "Pessoa de teste" },
    document_type: { id: "passport", label: { "pt-PT": "Passaporte" } },
  },
}));
vi.mock("../../lib/supabase", () => ({ supabase: { storage: { from: () => ({ upload: mocks.upload }) }, rpc: mocks.rpc } }));
vi.mock("../../lib/clientData", () => ({ useClientProcesses: () => ({ current: mocks.current, query: { isPending: false } }) }));
vi.mock("../../lib/documentData", () => ({ useDocuments: () => ({
  data: { requests: [mocks.request], documents: [] }, isPending: false, isError: false, refresh: mocks.refresh,
}) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null, data: "document-id" });
  mocks.refresh.mockResolvedValue(undefined);
  mocks.current.completed_at = null;
  mocks.request.status = "pending";
});

describe("envio de documentos do cliente", () => {
  it("valida antes de enviar e regista o ficheiro no pedido certo", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderAt("/documentos", <ClientDocuments />);
    expect(screen.getAllByText("Por enviar").length).toBeGreaterThan(0);
    const input = screen.getByLabelText("Escolher ficheiro ou arrastar para aqui");
    await user.upload(input, new File(["x"], "ficheiro.html", { type: "text/html" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha um ficheiro PDF");
    expect(mocks.upload).not.toHaveBeenCalled();
    await user.upload(input, new File(["pdf de teste"], "passaporte.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^org\/process\/uploads\/request\/.*\.pdf$/);
    expect(mocks.rpc).toHaveBeenCalledWith("register_upload", {
      p_request_id: "request", p_storage_path: mocks.upload.mock.calls[0][0], p_file_name: "passaporte.pdf",
    });
  });
  it("repete apenas o registo após falha de rede, sem voltar a carregar o ficheiro", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "Failed to fetch" } }).mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    renderAt("/documentos", <ClientDocuments />);
    await user.upload(screen.getByLabelText("Escolher ficheiro ou arrastar para aqui"), new File(["pdf"], "ficheiro.pdf", { type: "application/pdf" }));
    await user.click(await screen.findByRole("button", { name: "Concluir registo" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
  });
  it("processo concluído não apresenta controlo de upload", () => {
    mocks.current.completed_at = "2026-11-17";
    renderAt("/documentos", <ClientDocuments />);
    expect(screen.queryByLabelText("Escolher ficheiro ou arrastar para aqui")).not.toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("pedidos em análise não permitem substituir o ficheiro", () => {
    mocks.request.status = "submitted";
    renderAt("/documentos", <ClientDocuments />);
    expect(screen.queryByLabelText("Escolher ficheiro ou arrastar para aqui")).not.toBeInTheDocument();
    expect(screen.getByText("Recebido. A equipa vai analisar o ficheiro.")).toBeInTheDocument();
  });
});
