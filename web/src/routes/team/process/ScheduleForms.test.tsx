import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "../../../test/fixtures";
import type { Deadline } from "../../../lib/schedule";
import { DeadlineForm } from "./ProcessDeadlines";
import { StepForm } from "./ProcessTimeline";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), saved: vi.fn(), cancel: vi.fn() }));
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("../../../lib/documentData", () => ({ useDocumentOptions: () => ({ isSuccess: true, data: { people: [{ id: "person", full_name: "Marta Exemplo" }] } }) }));
vi.mock("../../../lib/teamData", async (importOriginal) => ({ ...await importOriginal<typeof import("../../../lib/teamData")>(), useTeamSettings: () => ({ today: "2026-11-17" }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ error: null }); mocks.saved.mockResolvedValue(undefined); });

describe("formulários de prazos e percurso", () => {
  it("valida prazo manual e envia processo, pessoa, data e estado", async () => {
    const user = userEvent.setup();
    renderAt("/test", <DeadlineForm processId="process" onCancel={mocks.cancel} onSaved={mocks.saved} />);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Título do prazo"), "Revisão anual");
    await user.type(screen.getByLabelText("Data do prazo"), "2026-12-01");
    await user.selectOptions(screen.getByLabelText("A quem se aplica"), "person");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith("save_deadline", expect.objectContaining({ p_process_id: "process", p_person_id: "person", p_due_on: "2026-12-01", p_status: "open", p_title: "Revisão anual" }));
  });
  it("prazo documental só permite estado e envia a versão lida", async () => {
    const user = userEvent.setup();
    const deadline = { id: "deadline", process_id: "process", document_id: "document", person_id: null, deadline_type: "licence", due_on: "2027-01-01", title: null, status: "open", updated_at: "2026-11-17T10:00:00Z" } as Deadline;
    renderAt("/test", <DeadlineForm processId="process" deadline={deadline} onCancel={mocks.cancel} onSaved={mocks.saved} />);
    expect(screen.queryByLabelText("Data do prazo")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Renovado" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Estado"), "renewing");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith("save_deadline", expect.objectContaining({ p_due_on: "2027-01-01", p_status: "renewing", p_expected_updated_at: deadline.updated_at }));
  });
  it("mostra conflito sem fechar o formulário nem comunicar sucesso", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "schedule_conflict" } });
    const user = userEvent.setup();
    renderAt("/test", <StepForm processId="process" onCancel={mocks.cancel} onSaved={mocks.saved} />);
    await user.type(screen.getByLabelText("Título do passo"), "Reunião");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("alterado entretanto");
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título do passo")).toHaveValue("Reunião");
  });
  it("conclui passo com o dia da organização e cancela sem submeter", async () => {
    const user = userEvent.setup();
    renderAt("/test", <StepForm processId="process" onCancel={mocks.cancel} onSaved={mocks.saved} />);
    await user.type(screen.getByLabelText("Título do passo"), "Reunião");
    await user.selectOptions(screen.getByLabelText("Estado"), "done");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith("save_timeline_step", expect.objectContaining({ p_status: "done", p_done_on: "2026-11-17", p_phase: "incorporation" }));
  });
});
