import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router";
import { AuthLayout } from "../../components/AuthLayout";
import { ROUTES } from "../../lib/access";
import { useAuth } from "../../lib/AuthProvider";
import { useOrg } from "../../lib/OrgProvider";
import { RequestLinkForm } from "./RequestLinkForm";

export default function ClientLogin() {
  const { t } = useTranslation();
  const org = useOrg();
  const { session } = useAuth();
  if (session) return <Navigate to={ROUTES.clientHome} replace />;
  return (
    <AuthLayout title={t("client_login.title")} intro={t("client_login.intro", { org: org.name })}>
      <RequestLinkForm />
      <p className="mt-6 text-center text-sm">
        <Link to={ROUTES.teamLogin} className="text-action hover:underline">
          {t("client_login.team_link")}
        </Link>
      </p>
    </AuthLayout>
  );
}
