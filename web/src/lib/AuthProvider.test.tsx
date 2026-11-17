import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { CLIENT_CONTEXT, ORG } from "../test/fixtures";
import { AuthProvider, useAuth } from "./AuthProvider";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), rpc: vi.fn(), listener: null as null | ((event: AuthChangeEvent, session: Session | null) => void),
}));
vi.mock("./OrgProvider", () => ({ useOrg: () => ORG }));
vi.mock("./supabase", () => ({ supabase: {
  rpc: mocks.rpc,
  auth: {
    getSession: mocks.getSession,
    onAuthStateChange: (listener: typeof mocks.listener) => {
      mocks.listener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    },
  },
} }));

function session(id: string, aal = "aal1") {
  return { user: { id }, access_token: `test.${btoa(JSON.stringify({ aal }))}.test` } as Session;
}
function Screen() {
  const { ready, session, aal } = useAuth();
  const [draft, setDraft] = useState("");
  return ready && <><p>{session ? `${session.user.id}/${aal}` : "sem sessão"}</p>
    <input aria-label="Nota em edição" value={draft} onChange={(e) => setDraft(e.target.value)} /></>;
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AuthProvider><Screen /></AuthProvider></QueryClientProvider>);
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.getSession.mockResolvedValue({ data: { session: session("cliente-a") } });
  mocks.rpc.mockResolvedValue({ data: CLIENT_CONTEXT, error: null });
});

describe("isolamento dos dados em memória entre sessões", () => {
  it("terminar sessão noutra janela limpa consultas, mutações, processo escolhido e formulários", async () => {
    const client = setup();
    await screen.findByText("cliente-a/aal1");
    client.setQueryData(["org", "orvel"], ORG);
    client.setQueryData(["client-processes"], [{ id: "processo-a" }]);
    client.getMutationCache().build(client, {}, { context: undefined, data: "documento privado", error: null, failureCount: 0, failureReason: null, isPaused: false, status: "success", variables: undefined, submittedAt: 0 });
    sessionStorage.setItem("portal.process", "processo-a");
    await userEvent.type(screen.getByLabelText("Nota em edição"), "Dados do cliente A");
    act(() => mocks.listener!("SIGNED_OUT", null));
    expect(screen.getByText("sem sessão")).toBeInTheDocument();
    expect(client.getQueryData(["client-processes"])).toBeUndefined();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(client.getQueryData(["org", "orvel"])).toEqual(ORG);
    expect(sessionStorage.getItem("portal.process")).toBeNull();
    expect(screen.getByLabelText("Nota em edição")).toHaveValue("");
  });

  it("trocar de cliente sem logout local não reutiliza dados nem rascunhos", async () => {
    const client = setup();
    await screen.findByText("cliente-a/aal1");
    client.setQueryData(["schedule", ORG.id, "processo-a"], ["prazo privado"]);
    await userEvent.type(screen.getByLabelText("Nota em edição"), "Dados do cliente A");
    act(() => mocks.listener!("SIGNED_IN", session("cliente-b")));
    expect(screen.getByText("cliente-b/aal1")).toBeInTheDocument();
    expect(client.getQueryData(["schedule", ORG.id, "processo-a"])).toBeUndefined();
    expect(screen.getByLabelText("Nota em edição")).toHaveValue("");
  });

  it("preserva a sessão numa renovação normal e limpa dados quando o nível MFA baixa", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session("equipa", "aal2") } });
    const client = setup();
    await screen.findByText("equipa/aal2");
    client.setQueryData(["team-processes"], ["processo privado"]);
    await userEvent.type(screen.getByLabelText("Nota em edição"), "Em edição");
    act(() => mocks.listener!("TOKEN_REFRESHED", session("equipa", "aal2")));
    expect(client.getQueryData(["team-processes"])).toEqual(["processo privado"]);
    expect(screen.getByLabelText("Nota em edição")).toHaveValue("Em edição");
    act(() => mocks.listener!("TOKEN_REFRESHED", session("equipa", "aal1")));
    expect(client.getQueryData(["team-processes"])).toBeUndefined();
    expect(screen.getByLabelText("Nota em edição")).toHaveValue("");
  });

  it("uma leitura inicial atrasada não repõe a sessão terminada", async () => {
    let resolve!: (value: { data: { session: Session } }) => void;
    mocks.getSession.mockReturnValue(new Promise((done) => { resolve = done; }));
    setup();
    act(() => mocks.listener!("SIGNED_OUT", null));
    await act(async () => resolve({ data: { session: session("cliente-a") } }));
    await waitFor(() => expect(screen.getByText("sem sessão")).toBeInTheDocument());
  });

  it("uma consulta pendente não repõe dados privados depois do logout", async () => {
    const client = setup();
    await screen.findByText("cliente-a/aal1");
    let resolve!: (value: string[]) => void;
    const pending = client.fetchQuery({ queryKey: ["client", "documents", "processo-a"],
      queryFn: () => new Promise<string[]>((done) => { resolve = done; }) }).catch(() => undefined);
    act(() => mocks.listener!("SIGNED_OUT", null));
    await act(async () => { resolve(["documento do cliente A"]); await pending; });
    expect(client.getQueryData(["client", "documents", "processo-a"])).toBeUndefined();
  });
});
