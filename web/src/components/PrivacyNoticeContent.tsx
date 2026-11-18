import { useTranslation } from "react-i18next";
import { noticeText, type SessionContext } from "../lib/access";

// Formatação editorial limitada a títulos, listas e negrito. Todo o conteúdo continua
// a ser texto escapado pelo React; não interpreta HTML nem cria links a partir do aviso.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-primary">{part.slice(2, -2)}</strong>
      : part,
  );
}

export function PrivacyNoticeContent({ notice }: { notice: NonNullable<SessionContext["notice"]> }) {
  const { t, i18n } = useTranslation();
  const blocks = noticeText(notice, i18n.language).replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  return (
    <>
      <p className="mb-5 text-xs uppercase tracking-wide text-muted">{t("privacy.version", { version: notice.version })}</p>
      {blocks.map((block, i) => {
        if (/^#{1,3} [^\n]+$/.test(block)) {
          return <h2 key={i} className="mt-7 mb-3 text-xl font-medium text-primary">{inline(block.replace(/^#{1,3} /, ""))}</h2>;
        }
        if (block.startsWith("- ")) {
          return <ul key={i} className="mb-4 list-disc space-y-2 pl-5">{block.slice(2).split(/\n- /).map((item, j) =>
            <li key={j}>{inline(item.replace(/\n\s*/g, " "))}</li>,
          )}</ul>;
        }
        return <p key={i} className="mb-4 whitespace-pre-line last:mb-0">{inline(block)}</p>;
      })}
    </>
  );
}
