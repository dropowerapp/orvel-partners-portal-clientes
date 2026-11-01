// Início da área de cliente. O conteúdo (estado, próximo passo, pendentes) chega na etapa 4.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AppShell } from "../../components/AppShell";
import { ROUTES } from "../../lib/access";
import { useAuth } from "../../lib/AuthProvider";
import { supabase } from "../../lib/supabase";

export default function ClientHome() {
  const { t } = useTranslation();
  const { context } = useAuth();
  const clientQuery = useQuery({
    queryKey: ["my-client", context?.client_id],
    enabled: !!context?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("full_name").eq("id", context!.client_id!).single();
      if (error) throw error;
      return data;
    },
  });
  const firstName = clientQuery.data?.full_name.split(" ")[0];
  return (
    <AppShell afterSignOut={ROUTES.clientLogin}>
      <h1 className="mb-3 text-2xl font-semibold text-primary">
        {firstName ? t("client_home.title", { name: firstName }) : t("client_home.title_anonymous")}
      </h1>
      <p className="max-w-prose text-base leading-relaxed text-muted">{t("client_home.body")}</p>
    </AppShell>
  );
}
