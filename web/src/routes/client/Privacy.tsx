// Tomada de conhecimento do aviso (primeiro login e sempre que a versão muda).
// Os nomes históricos da RPC/tabela não representam consentimento para tratamentos opcionais.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { AuthLayout } from "../../components/AuthLayout";
import { PrivacyNoticeContent } from "../../components/PrivacyNoticeContent";
import { Alert, Button, Spinner } from "../../components/ui";
import { ROUTES } from "../../lib/access";
import { useAuth } from "../../lib/AuthProvider";
import { errorKey } from "../../lib/errors";
import { useOrg } from "../../lib/OrgProvider";
import { supabase } from "../../lib/supabase";

export default function Privacy() {
  const { t } = useTranslation();
  const org = useOrg();
  const navigate = useNavigate();
  const { ready, session, context, contextLoading, refresh, signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready || contextLoading) return <Spinner fullScreen />;
  if (!session) return <Navigate to={ROUTES.clientLogin} replace />;
  if (context?.role !== "client") return <Navigate to={ROUTES.clientHome} replace />;

  const signOutButton = (
    <Button
      variant="link"
      onClick={async () => {
        await signOut();
        navigate(ROUTES.clientLogin, { replace: true });
      }}
    >
      {t("app.sign_out")}
    </Button>
  );

  if (context.notice_missing || !context.notice) {
    if (!context.consent_required && !context.notice_missing) return <Navigate to={ROUTES.clientHome} replace />;
    return (
      <AuthLayout title={t("privacy.missing_title")} intro={t("privacy.missing_body", { org: org.name })}>
        {signOutButton}
      </AuthLayout>
    );
  }

  const notice = context.notice;

  async function accept() {
    if (!checked) {
      setError("privacy.must_check");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("accept_privacy_notice", {
      p_notice_id: notice.id,
      p_user_agent: navigator.userAgent,
    });
    if (rpcError) {
      setBusy(false);
      setError(errorKey(rpcError));
      return;
    }
    await refresh();
    navigate(ROUTES.clientHome, { replace: true });
  }

  return (
    <AuthLayout title={t("privacy.title")} intro={t("privacy.intro")}>
      <article
        className="mb-5 max-h-[50dvh] overflow-y-auto rounded-md border border-line bg-background p-4 text-sm leading-relaxed"
        aria-label={t("privacy.title")}
        tabIndex={0}
      >
        <PrivacyNoticeContent notice={notice} />
      </article>
      <div className="flex flex-col gap-4">
        {error && <Alert>{t(error)}</Alert>}
        <label className="flex items-start gap-3 text-base">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-action"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>{t("privacy.checkbox")}</span>
        </label>
        <Button onClick={accept} busy={busy}>{busy ? t("privacy.accepting") : t("privacy.accept")}</Button>
        <div className="text-center">{signOutButton}</div>
      </div>
    </AuthLayout>
  );
}
