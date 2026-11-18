import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthLayout } from "../../components/AuthLayout";
import { PrivacyNoticeContent } from "../../components/PrivacyNoticeContent";
import { Alert, Button, Spinner } from "../../components/ui";
import { ROUTES, type SessionContext } from "../../lib/access";
import { useOrg } from "../../lib/OrgProvider";
import { supabase } from "../../lib/supabase";

type PublishedNotice = NonNullable<SessionContext["notice"]> & { published_at: string };

export default function PublicPrivacy() {
  const { t, i18n } = useTranslation();
  const org = useOrg();
  // Consulta nova ao abrir: a marca pode estar em cache desde antes da publicação.
  // Sem dependência de sessão, de documentos ou de dados pessoais do cliente.
  const query = useQuery({
    queryKey: ["public-privacy", org.id, org.slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_public", { p_host: org.slug });
      if (error) throw error;
      return (data?.privacy_notice ?? null) as PublishedNotice | null;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const notice = query.data;

  return (
    <AuthLayout wide title={t("privacy.title")} intro={t("privacy.public_intro", { org: org.name })}>
      {query.isPending ? <Spinner /> : query.isError ? (
        <div className="space-y-4">
          <Alert>{t("privacy.public_error")}</Alert>
          <Button onClick={() => void query.refetch()} busy={query.isFetching}>{t("org.retry")}</Button>
        </div>
      ) : notice ? (
        <article className="rounded-md border border-line bg-background p-5 text-base leading-relaxed sm:p-7" aria-label={t("privacy.title")}>
          <p className="mb-2 text-sm text-muted">
            {t("privacy.published", { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeZone: "UTC" }).format(new Date(notice.published_at)) })}
          </p>
          <PrivacyNoticeContent notice={notice} />
        </article>
      ) : <p className="rounded-md border border-line bg-background p-5 leading-relaxed">{t("privacy.public_missing")}</p>}
      <Link to={ROUTES.clientLogin} className="mt-6 inline-block text-sm text-action underline-offset-4 hover:underline">
        {t("privacy.back_login")}
      </Link>
    </AuthLayout>
  );
}
