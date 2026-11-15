// Moldura das áreas autenticadas (cliente e equipa).
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAuth } from "../lib/AuthProvider";
import { OrgMark } from "./OrgMark";

export function AppShell({ children, afterSignOut }: { children: ReactNode; afterSignOut: string }) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-white focus:p-2">
        {t("app.skip_to_content")}
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
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
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
