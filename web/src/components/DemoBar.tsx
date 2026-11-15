// Barra do modo de demonstração (só em desenvolvimento, com VITE_DEMO_MODE=true): atalhos para
// percorrer os ecrãs com utilizadores fictícios. Nunca aparece no build de produção.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { demoLastLink, demoReset, demoSignInAs, demoSignOut, type DemoPersona, onDemoChange } from "../lib/demo/client";
import { useOrg } from "../lib/OrgProvider";

const go = (path: string) => window.location.assign(path);

export function DemoBar() {
  const { t } = useTranslation();
  const org = useOrg();
  const [open, setOpenState] = useState(() => sessionStorage.getItem("portal.demo-bar") !== "closed");
  const setOpen = (value: boolean) => {
    sessionStorage.setItem("portal.demo-bar", value ? "open" : "closed");
    setOpenState(value);
  };
  const [link, setLink] = useState(demoLastLink);

  useEffect(() => onDemoChange(() => setLink(demoLastLink())), []);

  const signInAs = (persona: DemoPersona) => {
    demoSignInAs(persona);
    go(persona === "team" ? "/equipa/mfa" : "/");
  };

  const action = "rounded-md border border-line bg-white px-3 py-1.5 text-left text-sm text-primary hover:bg-background";
  return (
    <aside aria-label={t("demo.title")} className="border-b-2 border-amber-300 bg-amber-50 px-4 py-2 text-primary">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm font-semibold">{t("demo.title")}</p>
        <p className="text-xs text-muted">{t("demo.body")}</p>
        <button type="button" onClick={() => setOpen(!open)} className="ml-auto text-xs text-muted underline">
          {open ? t("demo.hide") : t("demo.show")}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {link && (
            <button type="button" className={`${action} border-action font-semibold`} onClick={() => go(link.url)}>
              {t("demo.open_link", { email: link.email })}
            </button>
          )}
          <button type="button" className={action} onClick={() => signInAs("client_new")}>{t("demo.as_client_new")}</button>
          <button type="button" className={action} onClick={() => signInAs("client")}>{t("demo.as_client")}</button>
          <button
            type="button"
            className={action}
            onClick={() => {
              demoSignOut();
              go("/equipa/entrar");
            }}
          >
            {t("demo.as_team")}
          </button>
          <button
            type="button"
            className={action}
            onClick={() => {
              demoSignOut();
              go(org.slug === "orvel" ? "/entrar?org=exemplo" : "/entrar?org=orvel");
            }}
          >
            {org.slug === "orvel" ? t("demo.org_exemplo") : t("demo.org_orvel")}
          </button>
          <button
            type="button"
            className="px-1 text-xs text-muted underline"
            onClick={() => {
              demoReset();
              go("/entrar");
            }}
          >
            {t("demo.reset")}
          </button>
          <p className="w-full px-1 text-xs text-muted">{t("demo.team_hint")}</p>
        </div>
      )}
    </aside>
  );
}
