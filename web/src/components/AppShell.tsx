// Moldura das áreas autenticadas (cliente e equipa): cabeçalho, menu e conteúdo.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../lib/AuthProvider";
import { OrgMark } from "./OrgMark";

export interface NavItem {
  to: string;
  label: string;
  /** Só ativo no caminho exato (para a página inicial de cada área). */
  end?: boolean;
}

export function AppShell({
  children,
  afterSignOut,
  nav = [],
  bottomNav = false,
  wide = false,
}: {
  children: ReactNode;
  afterSignOut: string;
  nav?: NavItem[];
  /** No telemóvel o menu passa para uma barra fixa em baixo (área de cliente). */
  bottomNav?: boolean;
  /** Conteúdo mais largo (tabelas da equipa). */
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const width = wide ? "max-w-6xl" : "max-w-5xl";
  return (
    <div className={`flex min-h-dvh flex-col bg-background ${bottomNav ? "pb-20 sm:pb-0" : ""}`}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-white focus:p-2">
        {t("app.skip_to_content")}
      </a>
      <header className="border-b border-line bg-white">
        <div className={`mx-auto flex w-full ${width} items-center justify-between px-4 py-4 sm:px-6`}>
          <OrgMark />
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary-deep hover:bg-background"
            onClick={async () => {
              await signOut();
              navigate(afterSignOut, { replace: true });
            }}
          >
            {t("app.sign_out")}
          </button>
        </div>
        {nav.length > 0 && (
          <nav aria-label={t("app.main_menu")} className={bottomNav ? "hidden sm:block" : ""}>
            <ul className={`mx-auto flex w-full ${width} gap-1 overflow-x-auto px-2 sm:px-4`}>
              {nav.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
                        isActive ? "border-action text-primary" : "border-transparent text-muted hover:text-primary"
                      }`}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main id="conteudo" className={`mx-auto w-full ${width} flex-1 px-4 py-8 sm:px-6 sm:py-10`}>
        {children}
      </main>
      {bottomNav && nav.length > 0 && (
        <nav aria-label={t("app.main_menu")} className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white sm:hidden">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-14 items-center justify-center px-1 text-center text-xs font-semibold ${
                      isActive ? "text-action" : "text-muted"
                    }`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
