import { useTranslation } from "react-i18next";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { ComingSoonPanel } from "../components/ComingSoon";
import { RequireArea } from "../components/Guards";
import { TEAM_PATHS } from "../lib/teamData";
import Confirm from "./auth/Confirm";
import ClientHome from "./client/ClientHome";
import ClientLayout, { CLIENT_PATHS } from "./client/ClientLayout";
import ClientLogin from "./client/ClientLogin";
import { ClientComingSoon, ClientContact, ClientMore } from "./client/ClientPages";
import Privacy from "./client/Privacy";
import NoAccess from "./NoAccess";
import NotFound from "./NotFound";
import Clients from "./team/Clients";
import ForgotPassword from "./team/ForgotPassword";
import Mfa from "./team/Mfa";
import NewPassword from "./team/NewPassword";
import NewProcess from "./team/NewProcess";
import ProcessActivity from "./team/process/ProcessActivity";
import ProcessInternal from "./team/process/ProcessInternal";
import ProcessLayout from "./team/process/ProcessLayout";
import ProcessPayments from "./team/process/ProcessPayments";
import ProcessPeople from "./team/process/ProcessPeople";
import ProcessProposals from "./team/process/ProcessProposals";
import ProcessSummary from "./team/process/ProcessSummary";
import ProcessList from "./team/ProcessList";
import TeamLayout, { TeamComingSoon } from "./team/TeamLayout";
import TeamLogin from "./team/TeamLogin";

/** Separadores da ficha que chegam nas etapas seguintes (documentos, percurso, prazos). */
function ProcessTabComingSoon({ tab }: { tab: "documents" | "timeline" | "deadlines" }) {
  const { t } = useTranslation();
  return <ComingSoonPanel body={t(`process.coming_soon.${tab}`)} />;
}

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
  {
    element: <RequireArea area="client" />,
    children: [
      {
        element: <ClientLayout />,
        children: [
          { path: CLIENT_PATHS.home, element: <ClientHome /> },
          { path: CLIENT_PATHS.documents, element: <ClientComingSoon section="documents" /> },
          { path: CLIENT_PATHS.timeline, element: <ClientComingSoon section="timeline" /> },
          { path: CLIENT_PATHS.deadlines, element: <ClientComingSoon section="deadlines" /> },
          { path: CLIENT_PATHS.more, element: <ClientMore /> },
          { path: CLIENT_PATHS.proposal, element: <ClientComingSoon section="proposal" /> },
          { path: CLIENT_PATHS.payment, element: <ClientComingSoon section="payment" /> },
          { path: CLIENT_PATHS.details, element: <ClientComingSoon section="details" /> },
          { path: CLIENT_PATHS.contact, element: <ClientContact /> },
        ],
      },
    ],
  },
  // Área da equipa (só com MFA)
  {
    element: <RequireArea area="staff" />,
    children: [
      {
        path: TEAM_PATHS.home,
        element: <TeamLayout />,
        // Caminhos relativos a /equipa (ver TEAM_PATHS).
        children: [
          { index: true, element: <Navigate to={TEAM_PATHS.processes} replace /> },
          { path: "processos", element: <ProcessList /> },
          { path: "processos/novo", element: <NewProcess /> },
          {
            path: "processos/:processId",
            element: <ProcessLayout />,
            children: [
              { index: true, element: <ProcessSummary /> },
              { path: "pessoas", element: <ProcessPeople /> },
              { path: "proposta", element: <ProcessProposals /> },
              { path: "pagamentos", element: <ProcessPayments /> },
              { path: "documentos", element: <ProcessTabComingSoon tab="documents" /> },
              { path: "percurso", element: <ProcessTabComingSoon tab="timeline" /> },
              { path: "prazos", element: <ProcessTabComingSoon tab="deadlines" /> },
              { path: "interno", element: <ProcessInternal /> },
              { path: "atividade", element: <ProcessActivity /> },
            ],
          },
          { path: "clientes", element: <Clients /> },
          { path: "calendario", element: <TeamComingSoon section="calendar" /> },
          { path: "definicoes", element: <TeamComingSoon section="settings" /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
];

export const router = () => createBrowserRouter(routes);
