// Segundo fator da equipa (TOTP): configuração na primeira vez, código nas seguintes.
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { AuthLayout } from "../../components/AuthLayout";
import { Alert, Button, Spinner, TextField } from "../../components/ui";
import { ROUTES, safeNext } from "../../lib/access";
import { useAuth } from "../../lib/AuthProvider";
import { errorKey } from "../../lib/errors";
import { supabase } from "../../lib/supabase";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });
type Values = z.infer<typeof schema>;

type State =
  | { mode: "loading" }
  | { mode: "verify"; factorId: string }
  | { mode: "enroll"; factorId: string; qrCode: string; secret: string }
  | { mode: "error"; message: string };

export default function Mfa() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { ready, session, aal, refresh } = useAuth();
  const [state, setState] = useState<State>({ mode: "loading" });
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const next = safeNext(params.get("next"), ROUTES.teamHome);
  const { register, handleSubmit, formState, reset } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!session || aal === "aal2" || started.current) return;
    started.current = true;
    void (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setState({ mode: "error", message: errorKey(listError) });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setState({ mode: "verify", factorId: verified.id });

      // Configurações abandonadas a meio ficam por verificar: remover antes de criar outra.
      for (const factor of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Portal ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrollError || !enrolled) return setState({ mode: "error", message: errorKey(enrollError) });
      setState({ mode: "enroll", factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
  }, [session, aal]);

  if (!ready) return <Spinner fullScreen />;
  if (!session) return <Navigate to={ROUTES.teamLogin} replace />;
  if (aal === "aal2") return <Navigate to={next} replace />;

  const onSubmit = handleSubmit(async ({ code }) => {
    if (state.mode !== "verify" && state.mode !== "enroll") return;
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.trim() });
    if (verifyError) {
      reset({ code: "" });
      setError(errorKey(verifyError));
      return;
    }
    await refresh();
    navigate(next, { replace: true });
  });

  const enrolling = state.mode === "enroll";
  return (
    <AuthLayout
      title={enrolling ? t("mfa.title_enroll") : t("mfa.title_verify")}
      intro={enrolling ? t("mfa.intro_enroll") : t("mfa.intro_verify")}
    >
      {state.mode === "loading" && <Spinner />}
      {state.mode === "error" && <Alert>{t(state.message)}</Alert>}
      {(state.mode === "verify" || state.mode === "enroll") && (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {state.mode === "enroll" && (
            <div className="flex flex-col gap-3">
              <p className="text-base">{t("mfa.step_scan")}</p>
              <img src={state.qrCode} alt={t("mfa.qr_alt")} className="mx-auto size-48 rounded-md border border-line bg-white p-2" />
              <p className="text-sm text-muted">{t("mfa.step_manual")}</p>
              <code className="break-all rounded-md bg-background px-3 py-2 text-center font-mono text-sm tracking-wider">
                {state.secret}
              </code>
              <p className="text-base">{t("mfa.step_code")}</p>
            </div>
          )}
          {error && <Alert>{t(error)}</Alert>}
          <TextField
            label={t("mfa.code_label")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            error={formState.errors.code ? t("validation.code") : undefined}
            {...register("code")}
          />
          <Button type="submit" busy={formState.isSubmitting}>
            {formState.isSubmitting ? t("mfa.submitting") : t("mfa.submit")}
          </Button>
          <p className="text-sm text-muted">{t("mfa.lost_device")}</p>
        </form>
      )}
    </AuthLayout>
  );
}
