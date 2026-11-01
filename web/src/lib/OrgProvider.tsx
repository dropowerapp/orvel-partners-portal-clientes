import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CenteredMessage } from "../components/CenteredMessage";
import { Spinner } from "../components/ui";
import { setLocale } from "../i18n";
import { type PublicOrg, resolveOrgKey } from "./org";
import { supabase } from "./supabase";
import { applyTheme } from "./theme";

const OrgContext = createContext<PublicOrg | null>(null);

export function useOrg(): PublicOrg {
  const org = useContext(OrgContext);
  if (!org) throw new Error("useOrg fora de OrgProvider");
  return org;
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const key = resolveOrgKey(window.location, import.meta.env.DEV);
  const query = useQuery({
    queryKey: ["org", key],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_public", { p_host: key });
      if (error) throw error;
      return (data ?? null) as PublicOrg | null;
    },
    staleTime: Infinity,
  });

  const org = query.data;
  useEffect(() => {
    if (!org) return;
    applyTheme(org.theme);
    setLocale(org.default_locale);
    document.title = t("app.title", { org: org.name });
  }, [org, t]);

  if (query.isPending) return <Spinner fullScreen />;
  if (query.isError) {
    return (
      <CenteredMessage
        title={t("org.load_error_title")}
        body={t("org.load_error_body")}
        action={{ label: t("org.retry"), onClick: () => void query.refetch() }}
      />
    );
  }
  if (!org) return <CenteredMessage title={t("org.not_found_title")} body={t("org.not_found_body")} />;
  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>;
}
