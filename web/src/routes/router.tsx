import { createBrowserRouter, type RouteObject } from "react-router";
import { RequireArea } from "../components/Guards";
import Confirm from "./auth/Confirm";
import ClientHome from "./client/ClientHome";
import ClientLogin from "./client/ClientLogin";
import Privacy from "./client/Privacy";
import NoAccess from "./NoAccess";
import NotFound from "./NotFound";
import ForgotPassword from "./team/ForgotPassword";
import Mfa from "./team/Mfa";
import NewPassword from "./team/NewPassword";
import TeamHome from "./team/TeamHome";
import TeamLogin from "./team/TeamLogin";

export const routes: RouteObject[] = [
  // Públicas
  { path: "/entrar", element: <ClientLogin /> },
  { path: "/auth/confirmar", element: <Confirm /> },
  { path: "/equipa/entrar", element: <TeamLogin /> },
  { path: "/equipa/recuperar", element: <ForgotPassword /> },
  // Sessão iniciada, antes de entrar na área
  { path: "/equipa/mfa", element: <Mfa /> },
  { path: "/equipa/nova-password", element: <NewPassword /> },
  { path: "/privacidade", element: <Privacy /> },
  { path: "/sem-acesso", element: <NoAccess /> },
  // Área do cliente
  { element: <RequireArea area="client" />, children: [{ path: "/", element: <ClientHome /> }] },
  // Área da equipa (só com MFA)
  { element: <RequireArea area="staff" />, children: [{ path: "/equipa", element: <TeamHome /> }] },
  { path: "*", element: <NotFound /> },
];

export const router = () => createBrowserRouter(routes);
