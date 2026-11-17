// Página ou separador que ainda não tem conteúdo (chega numa etapa seguinte).
import { useTranslation } from "react-i18next";
import { PageTitle } from "./ui";

export function ComingSoonPage({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <PageTitle eyebrow={eyebrow} title={title}>
      {body}
    </PageTitle>
  );
}

export function ComingSoonPanel({ body }: { body: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-dashed border-line bg-white px-5 py-8 text-center">
      <p className="text-sm font-semibold text-primary">{t("coming_soon.title")}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}
