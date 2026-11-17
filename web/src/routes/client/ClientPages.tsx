// Páginas da área de cliente que ainda não têm conteúdo (etapas 4 a 6), o menu "Mais" e o contacto.
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ComingSoonPage } from "../../components/ComingSoon";
import { PageTitle } from "../../components/ui";
import { useOrg } from "../../lib/OrgProvider";
import { CLIENT_PATHS } from "./ClientLayout";

type Section = "documents";

export function ClientComingSoon({ section }: { section: Section }) {
  const { t } = useTranslation();
  const org = useOrg();
  return (
    <ComingSoonPage
      eyebrow={t("auth_layout.eyebrow_client")}
      title={t(`client_pages.${section}.title`)}
      body={t(`client_pages.${section}.body`, { email: org.contact_email ?? "" })}
    />
  );
}

export function ClientMore() {
  const { t } = useTranslation();
  const links: { to: string; label: string; hint: string }[] = [
    { to: CLIENT_PATHS.proposal, label: t("client_pages.proposal.title"), hint: t("client_pages.more.proposal_hint") },
    { to: CLIENT_PATHS.payment, label: t("client_pages.payment.title"), hint: t("client_pages.more.payment_hint") },
    { to: CLIENT_PATHS.details, label: t("client_pages.details.title"), hint: t("client_pages.more.details_hint") },
    { to: CLIENT_PATHS.contact, label: t("client_pages.contact.title"), hint: t("client_pages.more.contact_hint") },
  ];
  return (
    <>
      <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={t("client_pages.more.title")} />
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-background">
              <span>
                <span className="block font-semibold text-primary">{link.label}</span>
                <span className="block text-sm text-muted">{link.hint}</span>
              </span>
              <span aria-hidden="true" className="text-silver">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Botões de WhatsApp e email da organização. */
export function ContactButtons() {
  const { t } = useTranslation();
  const org = useOrg();
  const whatsapp = org.contact_whatsapp?.replace(/[^\d]/g, "");
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-action px-4 py-2.5 font-semibold text-white hover:bg-primary"
        >
          {t("client_pages.contact.whatsapp")}
        </a>
      )}
      {org.contact_email && (
        <a
          href={`mailto:${org.contact_email}`}
          className="inline-flex items-center justify-center rounded-md border border-line bg-white px-4 py-2.5 font-semibold text-primary hover:bg-background"
        >
          {t("client_pages.contact.email", { email: org.contact_email })}
        </a>
      )}
      {!whatsapp && !org.contact_email && <p className="text-muted">{t("client_pages.contact.none")}</p>}
    </div>
  );
}

export function ClientContact() {
  const { t } = useTranslation();
  const org = useOrg();
  return (
    <>
      <PageTitle eyebrow={t("auth_layout.eyebrow_client")} title={t("client_pages.contact.title")}>
        {t("client_pages.contact.body", { org: org.name })}
      </PageTitle>
      <ContactButtons />
    </>
  );
}
