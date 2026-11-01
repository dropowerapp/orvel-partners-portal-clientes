// Ecrãs de entrada: cartão centrado, pensado primeiro para telemóvel.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "../lib/OrgProvider";
import { OrgMark } from "./OrgMark";

export function AuthLayout({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) {
  const { t } = useTranslation();
  const org = useOrg();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="bg-primary px-5 py-4">
        <OrgMark inverted />
      </header>
      <main id="conteudo" className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-2 text-2xl font-semibold text-primary">{title}</h1>
          {intro && <div className="mb-6 text-base leading-relaxed text-muted">{intro}</div>}
          {children}
        </div>
      </main>
      {org.contact_email && (
        <footer className="px-4 pb-6 text-center text-sm text-muted">
          {t("app.contact_line", { email: org.contact_email })}
        </footer>
      )}
    </div>
  );
}
