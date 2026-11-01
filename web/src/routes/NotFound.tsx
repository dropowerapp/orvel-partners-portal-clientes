import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthLayout } from "../components/AuthLayout";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t("not_found.title")}>
      <Link to="/" className="text-action hover:underline">{t("not_found.back")}</Link>
    </AuthLayout>
  );
}
