// Ecrãs de entrada. Em ecrãs largos: painel da marca à esquerda (cor principal e símbolo da
// organização, como nas apresentações) e formulário à direita. No telemóvel: só o formulário,
// com o logótipo no topo.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "../lib/OrgProvider";
import { orgSymbolSrc } from "../lib/branding";
import { OrgMark } from "./OrgMark";
import { Eyebrow } from "./ui";

export function AuthLayout(
  { title, intro, children, area = "client" }: { title: string; intro?: ReactNode; children?: ReactNode; area?: "client" | "team" },
) {
  const { t } = useTranslation();
  const org = useOrg();
  const symbol = orgSymbolSrc(org);
  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="relative hidden w-[42%] max-w-2xl shrink-0 flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(90% 70% at 90% 15%, var(--org-primary-deep), transparent 70%)" }}
        />
        {symbol && (
          <img
            src={symbol}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 -right-40 w-[30rem] max-w-none -translate-y-1/2 select-none"
          />
        )}
        <p className="relative text-xs uppercase tracking-[0.3em] text-silver">{t("auth_layout.panel_eyebrow")}</p>
        <div className="relative max-w-xs">
          <p className="text-4xl leading-tight font-light">{t("auth_layout.panel_title")}</p>
          <span className="my-6 block h-px w-12 bg-silver/60" />
          <p className="text-base leading-relaxed font-light text-silver">{t("auth_layout.panel_body", { org: org.name })}</p>
        </div>
        <span />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line px-6 py-5 sm:px-10">
          <OrgMark />
        </header>
        <main id="conteudo" className="flex flex-1 items-start justify-center px-6 py-10 sm:px-10 lg:items-center">
          <div className="w-full max-w-md">
            <Eyebrow>{area === "team" ? t("auth_layout.eyebrow_team") : t("auth_layout.eyebrow_client")}</Eyebrow>
            <h1 className="text-3xl leading-tight font-light text-primary">{title}</h1>
            <span className="my-5 block h-px w-10 bg-silver" />
            {intro && <div className="mb-8 text-base leading-relaxed text-muted">{intro}</div>}
            {children}
          </div>
        </main>
        {org.contact_email && (
          <footer className="px-6 pb-6 text-sm text-muted sm:px-10">
            {t("app.contact_line", { email: org.contact_email })}
          </footer>
        )}
      </div>
    </div>
  );
}
