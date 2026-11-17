// Dados partilhados pelas páginas da equipa: definições da organização, nomes da equipa e formatos.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "./OrgProvider";
import { supabase } from "./supabase";
import { todayIn } from "./team";

export const TEAM_PATHS = {
  home: "/equipa",
  processes: "/equipa/processos",
  newProcess: "/equipa/processos/novo",
  process: (id: string) => `/equipa/processos/${id}`,
  clients: "/equipa/clientes",
  calendar: "/equipa/calendario",
  settings: "/equipa/definicoes",
} as const;

export interface TeamSettings {
  timezone: string;
  proposal_ref_prefix: string;
  default_locale: string;
}

const DEFAULT_TIMEZONE = "Asia/Dubai";

/** Definições da organização que a equipa usa no painel (fuso horário, prefixo das propostas). */
export function useTeamSettings() {
  const org = useOrg();
  const query = useQuery({
    queryKey: ["team-settings", org.id],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("timezone, proposal_ref_prefix, default_locale")
        .eq("id", org.id)
        .single();
      if (error) throw error;
      return data as TeamSettings;
    },
  });
  const timezone = query.data?.timezone ?? DEFAULT_TIMEZONE;
  return { settings: query.data, timezone, today: todayIn(timezone) };
}

/** Nomes da equipa (só para o painel; o cliente nunca os vê). */
export function useStaffNames() {
  const org = useOrg();
  const query = useQuery({
    queryKey: ["staff-names", org.id],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("user_id, display_name")
        .eq("organization_id", org.id)
        .eq("role", "admin");
      if (error) throw error;
      return (data ?? []) as { user_id: string; display_name: string | null }[];
    },
  });
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const m of query.data ?? []) names.set(m.user_id, m.display_name ?? "");
    return { list: query.data ?? [], nameOf: (id: string | null | undefined) => (id ? names.get(id) || null : null) };
  }, [query.data]);
}

/** Formatos de datas e valores no idioma do portal. */
export function useFormat() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const locale = i18n.language || "pt-PT";
    const dateOnly = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
    const dateLocal = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
    const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    const aed = new Intl.NumberFormat(locale, { style: "currency", currency: "AED" });
    return {
      /** Data AAAA-MM-DD (mostrada tal como está) ou o dia de um instante (na hora local). */
      date: (value: string | null | undefined) =>
        !value ? "—" : value.length <= 10 ? dateOnly.format(new Date(`${value}T00:00:00Z`)) : dateLocal.format(new Date(value)),
      dateTime: (value: string | null | undefined) => (value ? dateTime.format(new Date(value)) : "—"),
      aed: (value: number | string | null | undefined) =>
        value === null || value === undefined || value === "" ? "—" : aed.format(Number(value)),
    };
  }, [i18n.language]);
}
