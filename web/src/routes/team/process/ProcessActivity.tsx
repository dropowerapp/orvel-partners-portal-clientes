// Ficha · Atividade: registo do que aconteceu no processo (escrito pela base de dados).
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, Card, Spinner } from "../../../components/ui";
import { supabase } from "../../../lib/supabase";
import { useFormat, useStaffNames } from "../../../lib/teamData";
import { useProcess } from "./ProcessLayout";

interface ActivityRow {
  id: number;
  action: string;
  actor_user_id: string | null;
  actor_role: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const LIMIT = 200;

export default function ProcessActivity() {
  const { t } = useTranslation();
  const format = useFormat();
  const staff = useStaffNames();
  const { process } = useProcess();

  const activity = useQuery({
    queryKey: ["team-activity", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, actor_user_id, actor_role, metadata, created_at")
        .eq("process_id", process.id)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const describe = (row: ActivityRow) => {
    const key = `activity.actions.${row.action.replace(/\./g, "_")}`;
    const meta = row.metadata ?? {};
    return t(key, {
      defaultValue: row.action,
      from: typeof meta.from === "string" ? t(`process_status.${meta.from}`) : "",
      to: typeof meta.to === "string" ? t(`process_status.${meta.to}`) : "",
      reference: typeof meta.reference === "string" ? meta.reference : "",
      title: typeof meta.title === "string" ? (row.action.startsWith("deadline.") ? t(`deadline_type.${meta.title}`, { defaultValue: meta.title }) : meta.title) : "",
      reason: typeof meta.reason === "string" ? meta.reason : "",
    });
  };
  const actor = (row: ActivityRow) =>
    row.actor_role === "admin"
      ? (staff.nameOf(row.actor_user_id) ?? t("activity.roles.admin"))
      : t(`activity.roles.${row.actor_role}`, { defaultValue: row.actor_role });

  return (
    <Card title={t("activity.title")}>
      {activity.isPending && <Spinner />}
      {activity.isError && <Alert>{t("activity.load_error")}</Alert>}
      {activity.isSuccess && activity.data.length === 0 && <p className="text-sm text-muted">{t("activity.empty")}</p>}
      <ol className="divide-y divide-line">
        {(activity.data ?? []).map((row) => (
          <li key={row.id} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <span className="text-sm text-primary">{describe(row)}</span>
            <span className="shrink-0 text-xs text-muted">{[actor(row), format.dateTime(row.created_at)].join(" · ")}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
