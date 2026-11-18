import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useAuth } from "../lib/AuthProvider";
import { useOrg } from "../lib/OrgProvider";
import { Icon, type IconName } from "./Icon";
import { OrgMark } from "./OrgMark";

export interface NavItem { to: string; label: string; end?: boolean; icon?: IconName; activePaths?: string[] }
export function AppShell({ children, afterSignOut, nav = [], bottomNav = false, wide = false }: {
  children: ReactNode; afterSignOut: string; nav?: NavItem[]; bottomNav?: boolean; wide?: boolean;
}) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const org = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const area = t(bottomNav ? "auth_layout.eyebrow_client" : "auth_layout.eyebrow_team");
  const exit = async () => { await signOut(); navigate(afterSignOut, { replace: true }); };
  const links = (mobile = false) => nav.map((item) => (
    <li key={item.to}>
      <NavLink to={item.to} end={item.end} className={({ isActive }) =>
        (mobile ? "portal-mobile-link " : "portal-nav-link ") + (isActive || item.activePaths?.includes(location.pathname) ? "is-active" : "")}>
        <Icon name={item.icon ?? "files"} className={mobile ? "size-5" : "size-[19px]"} />
        <span>{item.label}</span>
      </NavLink>
    </li>
  ));
  return (
    <div className={"portal-shell " + (bottomNav ? "has-bottom-nav" : "")}>
      <a href="#conteudo" className="skip-link">{t("app.skip_to_content")}</a>
      <aside className="portal-sidebar">
        <div className="portal-brand"><OrgMark className="h-auto max-h-12 max-w-44" /></div>
        <p className="portal-nav-label">{area}</p>
        <nav aria-label={t("app.main_menu")}><ul className="flex flex-col gap-1.5">{links()}</ul></nav>
        <div className="portal-sidebar-bottom">
          {org.contact_email && <a className="portal-help" href={"mailto:" + org.contact_email}>
            <Icon name="shield" className="size-6" />
            <span><strong>{t("shell.help_title")}</strong><span>{t("shell.help_body")}</span></span>
            <Icon name="arrow" className="size-4" />
          </a>}
          <button type="button" className="portal-nav-link w-full" onClick={exit}><Icon name="logout" />{t("app.sign_out")}</button>
        </div>
      </aside>
      <div className="portal-body">
        <header className="portal-topbar">
          <div className="lg:hidden"><OrgMark className="h-8 max-w-44" /></div>
          <div className="hidden items-center gap-2 text-xs tracking-[0.15em] text-wordmark uppercase lg:flex">
            <span className="size-1.5 rounded-full bg-primary-deep" />{org.name}<span className="mx-2 text-silver">/</span>{area}
          </div>
          <span className="hidden items-center gap-2 text-xs text-muted sm:flex"><Icon name="shield" className="size-4" />{t("shell.private_area")}</span>
          <button type="button" aria-label={t("app.sign_out")} className="p-2 lg:hidden" onClick={exit}><Icon name="logout" /></button>
        </header>
        {!bottomNav && <nav aria-label={t("app.main_menu")} className="border-b border-line bg-white px-4 lg:hidden"><ul className="flex gap-1 overflow-x-auto">{links()}</ul></nav>}
        <main id="conteudo" className={"portal-main " + (wide ? "portal-main-wide" : "")}>{children}</main>
        <footer className="portal-footer"><span>{org.name}</span><span>{t("shell.footer")}</span></footer>
      </div>
      {bottomNav && <nav aria-label={t("app.main_menu")} className="portal-bottom-nav lg:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(nav.length, 1)}, minmax(0, 1fr))` }}>{links(true)}</ul>
      </nav>}
    </div>
  );
}
