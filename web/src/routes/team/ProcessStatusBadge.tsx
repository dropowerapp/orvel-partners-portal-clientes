import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "../../components/ui";
import type { ProcessStatus } from "../../lib/team";

const TONES: Record<ProcessStatus, BadgeTone> = {
  new: "neutral",
  proposal_sent: "info",
  awaiting_payment: "warning",
  awaiting_documents: "warning",
  in_progress: "info",
  completed: "success",
  cancelled: "neutral",
};

export function ProcessStatusBadge({ status }: { status: ProcessStatus }) {
  const { t } = useTranslation();
  return <Badge tone={TONES[status]}>{t(`process_status.${status}`)}</Badge>;
}
