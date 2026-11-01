// Destino dos links dos emails (convite, link mágico, recuperação de password).
import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { AuthLayout } from "../../components/AuthLayout";
import { Spinner } from "../../components/ui";
import { ROUTES } from "../../lib/access";
import { supabase } from "../../lib/supabase";
import { RequestLinkForm } from "../client/RequestLinkForm";

const ALLOWED_TYPES: EmailOtpType[] = ["magiclink", "recovery", "invite", "email"];

export default function Confirm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const valid = !!tokenHash && !!type && ALLOWED_TYPES.includes(type);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // O token só pode ser usado uma vez: evitar a segunda chamada do modo estrito do React.
    if (!valid || started.current) return;
    started.current = true;
    void supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! }).then(({ error }) => {
      if (error) {
        setFailed(true);
        return;
      }
      // Tirar o token do endereço e do histórico.
      navigate(type === "recovery" ? "/equipa/nova-password" : ROUTES.clientHome, { replace: true });
    });
  }, [valid, tokenHash, type, navigate]);

  if (!valid) {
    return (
      <AuthLayout title={t("confirm.invalid_title")} intro={t("confirm.invalid_body")}>
        <RequestLinkForm />
      </AuthLayout>
    );
  }
  if (failed) {
    return (
      <AuthLayout title={t("confirm.expired_title")} intro={t("confirm.expired_body")}>
        <RequestLinkForm />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title={t("confirm.verifying")}>
      <Spinner />
    </AuthLayout>
  );
}
