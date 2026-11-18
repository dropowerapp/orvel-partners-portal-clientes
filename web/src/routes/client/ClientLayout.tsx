// Moldura da área de cliente: pensada primeiro para telemóvel, com o menu numa barra em baixo.
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router";
import { AppShell } from "../../components/AppShell";
import { Alert, Button, Spinner } from "../../components/ui";
import { ROUTES } from "../../lib/access";
import { useClientProcesses } from "../../lib/clientData";
import { useFormat } from "../../lib/teamData";

export const CLIENT_PATHS = {
  home: "/",
  documents: "/documentos",
  timeline: "/percurso",
  deadlines: "/prazos",
  more: "/mais",
  proposal: "/proposta",
  payment: "/pagamento",
  details: "/dados",
  contact: "/contacto",
} as const;

export default function ClientLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { query, current } = useClientProcesses();
  const accepted = current?.proposal_accepted === true;
  const initialRoute = pathname === CLIENT_PATHS.proposal || pathname === CLIENT_PATHS.contact;
  let content = <Outlet key={current?.id ?? "no-process"} />;
  if (query.isPending) content = <Spinner />;
  else if (query.isError) content = (
    <div className="flex flex-col gap-3">
      <Alert>{t("client_home.load_error")}</Alert>
      <div><Button variant="secondary" onClick={() => void query.refetch()}>{t("org.retry")}</Button></div>
    </div>
  );
  else if (!accepted && !initialRoute) content = <Navigate to={CLIENT_PATHS.proposal} replace />;

  return (
    <AppShell
      afterSignOut={ROUTES.clientLogin}
      bottomNav
      nav={accepted ? [
        { to: CLIENT_PATHS.home, icon: "home", label: t("client_nav.home"), end: true },
        { to: CLIENT_PATHS.documents, icon: "files", label: t("client_nav.documents") },
        { to: CLIENT_PATHS.timeline, icon: "route", label: t("client_nav.timeline") },
        { to: CLIENT_PATHS.deadlines, icon: "calendar", label: t("client_nav.deadlines") },
        { to: CLIENT_PATHS.more, activePaths: [CLIENT_PATHS.proposal, CLIENT_PATHS.payment, CLIENT_PATHS.details, CLIENT_PATHS.contact], icon: "more", label: t("client_nav.more") },
      ] : [
        { to: CLIENT_PATHS.proposal, icon: "files", label: t("client_proposal.title") },
        { to: CLIENT_PATHS.contact, icon: "mail", label: t("client_pages.contact.title") },
      ]}
    >
      <ProcessPicker />
      {!accepted && !query.isPending && !query.isError && (
        <p className="mb-6 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">
          {t("client_proposal.access_intro")}
        </p>
      )}
      {content}
    </AppShell>
  );
}

/** Seletor de processo no topo, só quando o cliente tem mais de um. */
function ProcessPicker() {
  const { t } = useTranslation();
  const format = useFormat();
  const { list, current, choose } = useClientProcesses();
  if (list.length < 2 || !current) return null;
  return (
    <label className="mb-6 flex flex-col gap-1 text-sm font-semibold text-primary sm:max-w-sm">
      {t("client_nav.process_picker")}
      <select
        value={current.id}
        onChange={(e) => choose(e.target.value)}
        className="rounded-md border border-line bg-white px-3 py-2 text-base font-normal"
      >
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {[p.plan_name ?? t("process.no_plan"), t("process.created_on", { date: format.date(p.created_at) })].join(" · ")}
          </option>
        ))}
      </select>
    </label>
  );
}
