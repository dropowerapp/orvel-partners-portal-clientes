// Utilitários dos testes de componentes (dados fictícios).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { SessionContext } from "../lib/access";
import type { PublicOrg } from "../lib/org";

export const ORG: PublicOrg = {
  id: "00000000-0000-0000-0000-0000000000aa",
  name: "Orvel Partners",
  slug: "orvel",
  logo_path: null,
  theme: null,
  contact_email: "hello@orvelpartners.com",
  contact_whatsapp: null,
  default_locale: "pt-PT",
};

export const CLIENT_CONTEXT: SessionContext = {
  role: "client",
  client_id: "11111111-1111-4111-8111-111111111111",
  mfa_required: false,
  consent_required: false,
  notice_missing: false,
  notice: null,
};

/** Renderiza `element` em `path`, com as outras rotas a mostrar só o seu caminho. */
export function renderAt(path: string, element: ReactElement, extraRoutes: string[] = []) {
  const router = createMemoryRouter(
    [
      { path: path.split("?")[0], element },
      ...extraRoutes.map((p) => ({ path: p, element: <p>rota:{p}</p> })),
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
