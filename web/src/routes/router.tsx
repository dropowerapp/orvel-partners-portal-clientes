import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { RequireArea } from "../components/Guards";
import { TEAM_PATHS } from "../lib/teamData";
import Confirm from "./auth/Confirm";
import ClientDocuments from "./client/ClientDocuments";
import ClientHome from "./client/ClientHome";
import ClientLayout, { CLIENT_PATHS } from "./client/ClientLayout";
import ClientLogin from "./client/ClientLogin";
import ClientDeadlines from "./client/ClientDeadlines";
import ClientDetails from "./client/ClientDetails";
import { ClientContact, ClientMore } from "./client/ClientPages";
import ClientPayment from "./client/ClientPayment";
import ClientProposal from "./client/ClientProposal";
import ClientTimeline from "./client/ClientTimeline";
import Privacy from "./client/Privacy";
import PublicPrivacy from "./client/PublicPrivacy";
import NoAccess from "./NoAccess";
import NotFound from "./NotFound";
import Clients from "./team/Clients";
import ForgotPassword from "./team/ForgotPassword";
import Mfa from "./team/Mfa";
import NewPassword from "./team/NewPassword";
import NewProcess from "./team/NewProcess";
import ProcessDocuments from "./team/process/ProcessDocuments";
import ProcessActivity from "./team/process/ProcessActivity";
import ProcessInternal from "./team/process/ProcessInternal";
import ProcessLayout from "./team/process/ProcessLayout";
import ProcessPayments from "./team/process/ProcessPayments";
import ProcessPeople from "./team/process/ProcessPeople";
import ProcessProposals from "./team/process/ProcessProposals";
import ProcessSummary from "./team/process/ProcessSummary";
import ProcessTimeline from "./team/process/ProcessTimeline";
import ProcessDeadlines from "./team/process/ProcessDeadlines";
import Calendar from "./team/Calendar";
import ProcessList from "./team/ProcessList";
import TeamLayout, { TeamComingSoon } from "./team/TeamLayout";
import TeamLogin from "./team/TeamLogin";

export const routes: RouteObject[] = [
  // Públicas
  { path: "/entrar", element: <ClientLogin /> },
  { path: "/aviso-de-privacidade", element: <PublicPrivacy /> },
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
          { path: CLIENT_PATHS.documents, element: <ClientDocuments /> },
          { path: CLIENT_PATHS.timeline, element: <ClientTimeline /> },
          { path: CLIENT_PATHS.deadlines, element: <ClientDeadlines /> },
          { path: CLIENT_PATHS.more, element: <ClientMore /> },
          { path: CLIENT_PATHS.proposal, element: <ClientProposal /> },
          { path: CLIENT_PATHS.payment, element: <ClientPayment /> },
          { path: CLIENT_PATHS.details, element: <ClientDetails /> },
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
              { path: "documentos", element: <ProcessDocuments /> },
              { path: "percurso", element: <ProcessTimeline /> },
              { path: "prazos", element: <ProcessDeadlines /> },
              { path: "interno", element: <ProcessInternal /> },
              { path: "atividade", element: <ProcessActivity /> },
            ],
          },
          { path: "clientes", element: <Clients /> },
          { path: "calendario", element: <Calendar /> },
          { path: "definicoes", element: <TeamComingSoon section="settings" /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
];

export const router = () => createBrowserRouter(routes);
