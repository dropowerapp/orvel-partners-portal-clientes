// Textos dos emails. Todos os textos ficam nos ficheiros de tradução (_shared/i18n/*.json).
import ptPT from "./i18n/pt-PT.json" with { type: "json" };

type Dict = { [key: string]: string | Dict };

const dictionaries: Record<string, Dict> = { "pt-PT": ptPT };
export const DEFAULT_LOCALE = "pt-PT";

function lookup(dict: Dict, key: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Traduz `key` para `locale` (com recurso a pt-PT) e substitui {variáveis}. */
export function t(locale: string | null | undefined, key: string, vars: Record<string, string | number> = {}): string {
  const dict = dictionaries[locale ?? ""] ?? dictionaries[DEFAULT_LOCALE];
  const template = lookup(dict, key) ?? lookup(dictionaries[DEFAULT_LOCALE], key);
  if (template === undefined) throw new Error(`missing_translation:${key}`);
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function expiryText(locale: string | null | undefined, hours: number): string {
  return hours === 1 ? t(locale, "common.expiry_hours_one") : t(locale, "common.expiry_hours_other", { count: hours });
}
