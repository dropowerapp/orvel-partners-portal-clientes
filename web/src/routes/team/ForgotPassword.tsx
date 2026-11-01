import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { z } from "zod";
import { AuthLayout } from "../../components/AuthLayout";
import { Alert, Button, TextField } from "../../components/ui";
import { ROUTES } from "../../lib/access";
import { errorCode } from "../../lib/errors";
import { supabase } from "../../lib/supabase";

const schema = z.object({ email: z.email() });
type Values = z.infer<typeof schema>;

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/confirmar`,
    });
    // Só mostra erros de limite ou de rede (nunca revela se o email tem conta).
    const code = authError ? errorCode(authError) : null;
    if (code && ["over_email_send_rate_limit", "over_request_rate_limit", "network"].includes(code)) {
      setError(`errors.${code}`);
      return;
    }
    setSentTo(email.trim());
  });

  return (
    <AuthLayout title={t("forgot.title")} intro={sentTo ? undefined : t("forgot.intro")}>
      {sentTo ? <Alert tone="success">{t("forgot.sent", { email: sentTo })}</Alert> : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && <Alert>{t(error)}</Alert>}
          <TextField
            label={t("team_login.email_label")}
            type="email"
            autoComplete="username"
            error={formState.errors.email ? t("validation.email") : undefined}
            {...register("email")}
          />
          <Button type="submit" busy={formState.isSubmitting}>{t("forgot.submit")}</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to={ROUTES.teamLogin} className="text-action hover:underline">{t("app.back_to_login")}</Link>
      </p>
    </AuthLayout>
  );
}
