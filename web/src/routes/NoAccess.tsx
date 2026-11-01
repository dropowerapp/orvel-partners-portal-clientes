import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui";
import { ROUTES } from "../lib/access";
import { useAuth } from "../lib/AuthProvider";
import { useOrg } from "../lib/OrgProvider";

export default function NoAccess() {
  const { t } = useTranslation();
  const org = useOrg();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <AuthLayout title={t("no_access.title")} intro={t("no_access.body", { email: org.contact_email ?? "" })}>
      <Button
        variant="secondary"
        onClick={async () => {
          await signOut();
          navigate(ROUTES.clientLogin, { replace: true });
        }}
      >
        {t("app.sign_out")}
      </Button>
    </AuthLayout>
  );
}
