// Painel da equipa (provisório): lista de clientes com envio e reenvio do convite.
// A lista de processos, filtros e ficha completa chegam na etapa 3.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../../components/AppShell";
import { Alert, Button, Spinner } from "../../components/ui";
import { ROUTES } from "../../lib/access";
import { functionErrorCode } from "../../lib/errors";
import { useOrg } from "../../lib/OrgProvider";
import { supabase } from "../../lib/supabase";

interface ClientRow {
  id: string;
  full_name: string;
  email: string;
  invited_at: string | null;
  last_invite_sent_at: string | null;
}

export default function TeamHome() {
  const { t, i18n } = useTranslation();
  const org = useOrg();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const clients = useQuery({
    queryKey: ["team-clients", org.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email, invited_at, last_invite_sent_at")
        .eq("organization_id", org.id)
        .order("full_name");
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const invite = useMutation({
    mutationFn: async (client: ClientRow) => {
      const { error } = await supabase.functions.invoke("invite-client", { body: { client_id: client.id } });
      if (error) throw new Error(await functionErrorCode(error));
      return client;
    },
    onSuccess: (client) => {
      setFeedback({ tone: "success", text: t("team_home.sent", { email: client.email }) });
      void queryClient.invalidateQueries({ queryKey: ["team-clients"] });
    },
    onError: (error) => setFeedback({ tone: "error", text: t(`errors.${error.message}`) }),
  });

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  return (
    <AppShell afterSignOut={ROUTES.teamLogin}>
      <h1 className="mb-2 text-2xl font-semibold text-primary">{t("team_home.title")}</h1>
      <p className="mb-6 max-w-prose text-muted">{t("team_home.intro")}</p>
      {feedback && <div className="mb-4"><Alert tone={feedback.tone}>{feedback.text}</Alert></div>}
      {clients.isPending && <Spinner />}
      {clients.isError && <Alert>{t("team_home.load_error")}</Alert>}
      {clients.data?.length === 0 && <p className="text-muted">{t("team_home.empty")}</p>}
      {clients.data && clients.data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-background text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">{t("team_home.col_name")}</th>
                <th className="px-4 py-3">{t("team_home.col_email")}</th>
                <th className="px-4 py-3">{t("team_home.col_invite")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.data.map((client) => {
                const sending = invite.isPending && invite.variables?.id === client.id;
                return (
                  <tr key={client.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold text-primary">{client.full_name}</td>
                    <td className="px-4 py-3">{client.email}</td>
                    <td className="px-4 py-3 text-muted">
                      {client.last_invite_sent_at
                        ? t("team_home.invited_on", { date: dateFormat.format(new Date(client.last_invite_sent_at)) })
                        : t("team_home.not_invited")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        busy={sending}
                        disabled={invite.isPending}
                        onClick={() => {
                          setFeedback(null);
                          invite.mutate(client);
                        }}
                      >
                        {sending ? t("team_home.sending") : client.invited_at ? t("team_home.resend") : t("team_home.invite")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
