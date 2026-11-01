import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { SessionContext } from "../lib/access";
import { CLIENT_CONTEXT } from "../test/fixtures";
import { RequireArea } from "./Guards";

let auth: { ready: boolean; session: unknown; context: SessionContext | null; contextLoading: boolean; aal: string | null };
vi.mock("../lib/AuthProvider", () => ({ useAuth: () => auth }));

function renderGuard(area: "client" | "staff", path: string) {
  const router = createMemoryRouter(
    [
      { element: <RequireArea area={area} />, children: [{ path: "/", element: <p>área cliente</p> }, { path: "/equipa", element: <p>área equipa</p> }] },
      ...["/entrar", "/equipa/entrar", "/equipa/mfa", "/privacidade", "/sem-acesso"].map((p) => ({ path: p, element: <p>rota:{p}</p> })),
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("RequireArea", () => {
  it("sem sessão → página de entrada da área, com regresso", () => {
    auth = { ready: true, session: null, context: null, contextLoading: false, aal: null };
    const router = renderGuard("staff", "/equipa");
    expect(screen.getByText("rota:/equipa/entrar")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Fequipa");
  });

  it("equipa sem MFA → código", () => {
    auth = { ready: true, session: {}, context: { ...CLIENT_CONTEXT, role: "admin" }, contextLoading: false, aal: "aal1" };
    renderGuard("staff", "/equipa");
    expect(screen.getByText("rota:/equipa/mfa")).toBeInTheDocument();
  });

  it("cliente sem consentimento → aviso de privacidade", () => {
    auth = { ready: true, session: {}, context: { ...CLIENT_CONTEXT, consent_required: true }, contextLoading: false, aal: "aal1" };
    renderGuard("client", "/");
    expect(screen.getByText("rota:/privacidade")).toBeInTheDocument();
  });

  it("cliente com tudo em dia entra; na área da equipa volta para a sua", () => {
    auth = { ready: true, session: {}, context: CLIENT_CONTEXT, contextLoading: false, aal: "aal1" };
    renderGuard("client", "/");
    expect(screen.getByText("área cliente")).toBeInTheDocument();
  });

  it("sem acesso a esta organização → sem acesso", () => {
    auth = { ready: true, session: {}, context: { ...CLIENT_CONTEXT, role: null }, contextLoading: false, aal: "aal1" };
    renderGuard("client", "/");
    expect(screen.getByText("rota:/sem-acesso")).toBeInTheDocument();
  });
});
