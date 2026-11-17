// Botão de ação irreversível com confirmação no próprio sítio (sem janelas do browser).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui";

export function ConfirmButton({
  label,
  confirmLabel,
  question,
  onConfirm,
  busy = false,
  disabled = false,
  variant = "secondary",
}: {
  label: string;
  confirmLabel: string;
  question: string;
  onConfirm: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "link";
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button type="button" variant={variant} disabled={disabled || busy} busy={busy} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span role="group" className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span className="text-primary">{question}</span>
      <Button
        type="button"
        busy={busy}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button type="button" variant="link" onClick={() => setAsking(false)}>
        {t("actions.cancel")}
      </Button>
    </span>
  );
}
