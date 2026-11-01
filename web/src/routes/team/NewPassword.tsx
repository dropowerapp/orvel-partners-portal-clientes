// Nova password depois do link de recuperação. Quem já tem MFA tem de passar o código antes
// (o Supabase exige aal2 para alterar a conta de quem tem segundo fator).
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { z } from "zod";
import { AuthLayout } from "../../components/AuthLayout";
import { Alert, Button, Spinner, TextField } from "../../components/ui";
import { ROUTES } from "../../lib/access";
import { useAuth } from "../../lib/AuthProvider";
import { errorKey } from "../../lib/errors";
import { supabase } from "../../lib/supabase";

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;

const schema = z
  .object({ password: z.string().regex(PASSWORD_RULE), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] });
type Values = z.infer<typeof schema>;

export default function NewPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ready, session, aal } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const factors = useQuery({
    queryKey: ["mfa-factors", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      return data.totp.some((f) => f.status === "verified");
    },
  });

  if (!ready || (session && factors.isPending)) return <Spinner fullScreen />;
  if (!session) return <Navigate to={ROUTES.teamLogin} replace />;
  if (factors.data && aal !== "aal2") {
    return <Navigate to={`${ROUTES.mfa}?next=${encodeURIComponent("/equipa/nova-password")}`} replace />;
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(errorKey(updateError));
      return;
    }
    navigate(ROUTES.teamHome, { replace: true });
  });

  return (
    <AuthLayout title={t("new_password.title")} intro={t("new_password.intro")}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert>{t(error)}</Alert>}
        <TextField
          label={t("new_password.password_label")}
          type="password"
          autoComplete="new-password"
          error={formState.errors.password ? t("validation.password_rules") : undefined}
          {...register("password")}
        />
        <TextField
          label={t("new_password.confirm_label")}
          type="password"
          autoComplete="new-password"
          error={formState.errors.confirm ? t("validation.password_match") : undefined}
          {...register("confirm")}
        />
        <Button type="submit" busy={formState.isSubmitting}>{t("new_password.submit")}</Button>
      </form>
    </AuthLayout>
  );
}
