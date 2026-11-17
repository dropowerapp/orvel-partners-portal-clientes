import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrg } from "./OrgProvider";
import { supabase } from "./supabase";
import type { Deadline, TeamStep } from "./schedule";

const DEADLINE_SELECT = "id, process_id, person_id, document_id, deadline_type, title, due_on, status, updated_at, person:people(full_name), document:documents(id, file_name, purged_at)";
export function useDeadlines(processId?: string, calendar = false) {
  const org = useOrg();
  return useQuery({
    queryKey: ["schedule", org.id, calendar ? "calendar" : processId],
    enabled: calendar || !!processId,
    queryFn: async () => {
      const rows: Deadline[] = [];
      // Paginate explicitly: the calendar must not silently omit clients after PostgREST's row cap.
      for (let offset = 0; ; offset += 500) {
        let query = supabase.from("deadlines").select(DEADLINE_SELECT + (calendar ? ", process:processes(id, client:clients(full_name))" : ""))
          .eq("organization_id", org.id).order("due_on").order("id").range(offset, offset + 499);
        if (calendar) query = query.in("status", ["open", "renewing"]);
        else query = query.eq("process_id", processId!);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...((data ?? []) as unknown as Deadline[]));
        if (!data || data.length < 500) break;
      }
      return rows;
    },
  });
}
export function useTeamSteps(processId: string) {
  return useQuery({ queryKey: ["team-steps", processId], queryFn: async () => {
    const { data, error } = await supabase.from("timeline_steps")
      .select("id, position, phase, title, status, planned_on, done_on, client_note, auto_event, updated_at")
      .eq("process_id", processId).order("position").order("id");
    if (error) throw error;
    return (data ?? []) as TeamStep[];
  } });
}
export function useRefreshSchedule(processId: string) {
  const client = useQueryClient();
  return () => Promise.all([
    ["schedule"], ["team-steps", processId], ["client"], ["team-processes"], ["team-activity", processId],
  ].map((queryKey) => client.invalidateQueries({ queryKey })));
}
