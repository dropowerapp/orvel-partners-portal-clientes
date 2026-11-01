// Traduções. Todos os textos do portal ficam em ficheiros de tradução (pt-PT agora; en mais tarde).
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptPT from "./pt-PT.json";

export const DEFAULT_LOCALE = "pt-PT";
export const SUPPORTED_LOCALES = ["pt-PT"] as const;

void i18n.use(initReactI18next).init({
  resources: { "pt-PT": { translation: ptPT } },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  // O React já escapa o texto.
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLocale(locale: string | null | undefined): void {
  const next = SUPPORTED_LOCALES.find((l) => l === locale) ?? DEFAULT_LOCALE;
  if (i18n.language !== next) void i18n.changeLanguage(next);
  document.documentElement.lang = next;
}

export default i18n;
