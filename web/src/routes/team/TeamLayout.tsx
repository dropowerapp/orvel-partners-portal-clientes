// Moldura da área da equipa (só com MFA): menu principal e conteúdo largo para as tabelas.
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { AppShell } from "../../components/AppShell";
import { ComingSoonPage } from "../../components/ComingSoon";
import { ROUTES } from "../../lib/access";
import { TEAM_PATHS } from "../../lib/teamData";

export default function TeamLayout() {
  const { t } = useTranslation();
  return (
    <AppShell
      afterSignOut={ROUTES.teamLogin}
      wide
      nav={[
        { to: TEAM_PATHS.processes, icon: "briefcase", label: t("team_nav.processes") },
        { to: TEAM_PATHS.clients, icon: "users", label: t("team_nav.clients") },
        { to: TEAM_PATHS.calendar, icon: "calendar", label: t("team_nav.calendar") },
        { to: TEAM_PATHS.settings, icon: "settings", label: t("team_nav.settings") },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}

export function TeamComingSoon({ section }: { section: "calendar" | "settings" }) {
  const { t } = useTranslation();
  return (
    <ComingSoonPage
      eyebrow={t("auth_layout.eyebrow_team")}
      title={t(`team_pages.${section}.title`)}
      body={t(`team_pages.${section}.body`)}
    />
  );
}
