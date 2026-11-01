// Composição e envio de emails com a marca da organização.
// Envio pela API da Brevo. Em desenvolvimento local, EMAIL_MODE=log escreve o email no log em vez
// de o enviar. Sem BREVO_API_KEY e fora do modo log, o envio falha (nunca se perde em silêncio).
import { expiryText, t } from "./i18n.ts";

export interface OrgBranding {
  id: string;
  name: string;
  slug: string;
  hostname: string | null;
  logo_path: string | null;
  theme: { colors?: Record<string, string>; font?: { family?: string } } | null;
  email_from_name: string;
  email_from_address: string;
  email_reply_to: string;
  contact_email: string | null;
  contact_whatsapp: string | null;
  default_locale: string;
}

export type AuthEmailKind = "invite" | "magiclink" | "recovery";

export interface EmailMessage {
  to: { email: string; name?: string };
  from: { email: string; name: string };
  replyTo: { email: string };
  subject: string;
  html: string;
  text: string;
  tags?: string[];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$/;
function color(org: OrgBranding, key: string, fallback: string): string {
  const value = org.theme?.colors?.[key];
  return value && SAFE_COLOR.test(value) ? value : fallback;
}

/** Endereço público do portal da organização (PUBLIC_SITE_URL substitui em desenvolvimento). */
export function portalUrl(org: Pick<OrgBranding, "hostname">, env: { PUBLIC_SITE_URL?: string }): string {
  if (env.PUBLIC_SITE_URL) return env.PUBLIC_SITE_URL.replace(/\/+$/, "");
  if (!org.hostname) throw new Error("organization_without_hostname");
  return `https://${org.hostname}`;
}

/** Link de confirmação tratado pelo frontend em /auth/confirmar (verifyOtp com token_hash). */
export function confirmLink(base: string, tokenHash: string, type: string): string {
  const url = new URL("/auth/confirmar", base);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  return url.toString();
}

export function logoUrl(org: OrgBranding, supabaseUrl: string | undefined): string | null {
  if (!org.logo_path || !supabaseUrl) return null;
  const path = org.logo_path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/branding/${path}`;
}

export interface AuthEmailInput {
  kind: AuthEmailKind;
  org: OrgBranding;
  locale: string | null;
  to: { email: string; name?: string | null };
  link: string;
  expiryHours: number;
  supabaseUrl?: string;
}

/** Email de autenticação (convite, link mágico, recuperação) em HTML e texto simples. */
export function buildAuthEmail(input: AuthEmailInput): EmailMessage {
  const { kind, org, locale, to, link } = input;
  const vars = { org: org.name };
  const contact = org.contact_email ?? org.email_reply_to;
  const greeting = to.name ? t(locale, "common.greeting", { name: to.name }) : t(locale, "common.greeting_anonymous");
  const paragraphs = [
    t(locale, `${kind}.intro`, vars),
  ];
  const security = t(locale, `${kind}.security`, { expiry: expiryText(locale, input.expiryHours) });
  const button = t(locale, `${kind}.button`);
  const title = t(locale, `${kind}.title`);
  const signature = t(locale, "common.signature", vars);
  const footer = t(locale, "common.footer", { org: org.name, contact });
  const fallback = t(locale, "common.button_fallback");

  const primary = color(org, "primary", "#0b1628");
  const action = color(org, "action", "#2a57c4");
  const background = color(org, "background", "#f4f6f9");
  const line = color(org, "line", "#d5dae2");
  const font = `${org.theme?.font?.family ? `'${escapeHtml(org.theme.font.family)}', ` : ""}Arial, Helvetica, sans-serif`;
  const logo = logoUrl(org, input.supabaseUrl);
  const header = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(org.name)}" height="32" style="display:block;height:32px;border:0">`
    : `<span style="color:#ffffff;font-size:18px;font-weight:600">${escapeHtml(org.name)}</span>`;

  const html = `<!doctype html>
<html lang="${escapeHtml(locale ?? "pt-PT")}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${
    escapeHtml(title)
  }</title></head>
<body style="margin:0;padding:0;background:${background};font-family:${font};color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${background};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${line};border-radius:8px;overflow:hidden">
<tr><td style="background:${primary};padding:20px 28px">${header}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:20px;color:${primary}">${escapeHtml(title)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(greeting)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(p)}</p>`).join("\n")}
<p style="margin:24px 0"><a href="${
    escapeHtml(link)
  }" style="display:inline-block;background:${action};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:6px">${
    escapeHtml(button)
  }</a></p>
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#4b5563">${escapeHtml(security)}</p>
<p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(fallback)}</p>
<p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all"><a href="${
    escapeHtml(link)
  }" style="color:${action}">${escapeHtml(link)}</a></p>
<p style="margin:0;font-size:15px;line-height:1.5">${escapeHtml(signature)}</p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${line};font-size:12px;line-height:1.5;color:#6b7280">${
    escapeHtml(footer)
  }</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [greeting, "", ...paragraphs, "", `${button}: ${link}`, "", security, "", signature, "", "--", footer].join("\n");

  return {
    to: { email: to.email, ...(to.name ? { name: to.name } : {}) },
    from: { email: org.email_from_address, name: org.email_from_name },
    replyTo: { email: org.email_reply_to },
    subject: t(locale, `${kind}.subject`, vars),
    html,
    text,
    tags: [`auth-${kind}`, `org-${org.slug}`],
  };
}

export interface SendEnv {
  BREVO_API_KEY?: string;
  EMAIL_MODE?: string;
}

/** Envia pela Brevo (ou escreve no log com EMAIL_MODE=log). Lança erro se falhar. */
export async function sendEmail(message: EmailMessage, env: SendEnv, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (env.EMAIL_MODE === "log") {
    console.log(`[email:log] to=${message.to.email} subject=${JSON.stringify(message.subject)}\n${message.text}`);
    return;
  }
  if (!env.BREVO_API_KEY) throw new Error("email_not_configured");

  const response = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: message.from,
      to: [message.to],
      replyTo: message.replyTo,
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
      tags: message.tags,
    }),
  });
  if (!response.ok) {
    // Não incluir o corpo do email no erro (contém o link de acesso).
    throw new Error(`email_send_failed:${response.status}`);
  }
}
