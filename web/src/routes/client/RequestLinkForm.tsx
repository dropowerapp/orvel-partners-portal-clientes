// Formulário "email → link mágico", usado no início de sessão e no ecrã de link expirado.
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Alert, Button, TextField } from "../../components/ui";
import { errorCode } from "../../lib/errors";
import { supabase } from "../../lib/supabase";

const schema = z.object({ email: z.email() });
type Values = z.infer<typeof schema>;

// Erros que não se mostram: revelariam se o email tem ou não conta no portal.
const SILENT = new Set(["otp_disabled", "signup_disabled", "user_not_found", "email_address_not_authorized"]);

export function RequestLinkForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const { t } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/confirmar` },
    });
    const code = (authError as { code?: string } | null)?.code;
    if (authError && !SILENT.has(code ?? "") && authError.status !== 422) {
      setError(code === "over_email_send_rate_limit" ? "client_login.rate_limited" : `errors.${errorCode(authError)}`);
      return;
    }
    setSentTo(email.trim());
  });

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-primary">{t("client_login.check_title")}</h2>
        <p className="text-base leading-relaxed">{t("client_login.check_body", { email: sentTo })}</p>
        <p className="text-sm text-muted">{t("client_login.check_spam")}</p>
        <Button variant="secondary" onClick={() => setSentTo(null)}>
          {t("client_login.check_again")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <Alert>{t(error)}</Alert>}
      <TextField
        label={t("client_login.email_label")}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder={t("client_login.email_placeholder")}
        error={formState.errors.email ? t("validation.email") : undefined}
        {...register("email")}
      />
      <Button type="submit" busy={formState.isSubmitting}>
        {formState.isSubmitting ? t("client_login.submitting") : t("client_login.submit")}
      </Button>
    </form>
  );
}
