import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { AuthLayout } from "../../components/AuthLayout";
import { Alert, Button, TextField } from "../../components/ui";
import { ROUTES, safeNext } from "../../lib/access";
import { errorKey } from "../../lib/errors";
import { supabase } from "../../lib/supabase";

const schema = z.object({ email: z.email(), password: z.string().min(1) });
type Values = z.infer<typeof schema>;

export default function TeamLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (authError) {
      setError(errorKey(authError));
      return;
    }
    // A password sozinha não dá acesso a dados: segue sempre para o MFA.
    const next = safeNext(params.get("next"), ROUTES.teamHome);
    navigate(`${ROUTES.mfa}?next=${encodeURIComponent(next)}`, { replace: true });
  });

  return (
    <AuthLayout title={t("team_login.title")} intro={t("team_login.intro")}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert>{t(error)}</Alert>}
        <TextField
          label={t("team_login.email_label")}
          type="email"
          autoComplete="username"
          error={formState.errors.email ? t("validation.email") : undefined}
          {...register("email")}
        />
        <TextField
          label={t("team_login.password_label")}
          type="password"
          autoComplete="current-password"
          error={formState.errors.password ? t("validation.required") : undefined}
          {...register("password")}
        />
        <Button type="submit" busy={formState.isSubmitting}>
          {formState.isSubmitting ? t("team_login.submitting") : t("team_login.submit")}
        </Button>
      </form>
      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        <Link to="/equipa/recuperar" className="text-action hover:underline">{t("team_login.forgot")}</Link>
        <Link to={ROUTES.clientLogin} className="text-muted hover:underline">{t("team_login.client_link")}</Link>
      </div>
    </AuthLayout>
  );
}
