// Tema da organização: cores e letra vêm de organizations.theme e são aplicadas como variáveis CSS.
export interface OrgTheme {
  colors?: Record<string, string>;
  font?: { family?: string; url?: string };
}

const COLOR_KEYS = ["primary", "primary-deep", "wordmark", "action", "silver", "background", "line"] as const;
const SAFE_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_FONT = /^[\p{L}\p{N} -]{1,60}$/u;

/** Converte o tema em variáveis CSS, ignorando valores inválidos (nunca injeta CSS arbitrário). */
export function themeToCssVars(theme: OrgTheme | null | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of COLOR_KEYS) {
    const value = theme?.colors?.[key];
    if (value && SAFE_COLOR.test(value)) vars[`--org-${key}`] = value;
  }
  const family = theme?.font?.family;
  if (family && SAFE_FONT.test(family)) vars["--org-font"] = `"${family}"`;
  return vars;
}

export function applyTheme(theme: OrgTheme | null | undefined, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(themeToCssVars(theme))) root.style.setProperty(name, value);
}
