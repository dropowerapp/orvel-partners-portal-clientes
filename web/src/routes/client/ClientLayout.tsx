// Moldura da área de cliente: pensada primeiro para telemóvel, com o menu numa barra em baixo.
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { AppShell } from "../../components/AppShell";
import { ROUTES } from "../../lib/access";

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
  return (
    <AppShell
      afterSignOut={ROUTES.clientLogin}
      bottomNav
      nav={[
        { to: CLIENT_PATHS.home, label: t("client_nav.home"), end: true },
        { to: CLIENT_PATHS.documents, label: t("client_nav.documents") },
        { to: CLIENT_PATHS.timeline, label: t("client_nav.timeline") },
        { to: CLIENT_PATHS.deadlines, label: t("client_nav.deadlines") },
        { to: CLIENT_PATHS.more, label: t("client_nav.more") },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
