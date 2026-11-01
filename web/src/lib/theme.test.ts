import { describe, expect, it } from "vitest";
import { applyTheme, themeToCssVars } from "./theme";

describe("themeToCssVars", () => {
  it("converte as cores e a letra da organização", () => {
    expect(themeToCssVars({ colors: { primary: "#0b1628", action: "#2a57c4" }, font: { family: "Source Sans 3" } })).toEqual({
      "--org-primary": "#0b1628",
      "--org-action": "#2a57c4",
      "--org-font": '"Source Sans 3"',
    });
  });

  it("ignora valores que não são cores ou nomes de letra válidos", () => {
    expect(
      themeToCssVars({
        colors: { primary: "red; background: url(x)", action: "#12", unknown: "#ffffff" },
        font: { family: "x\"; } body { display:none" },
      }),
    ).toEqual({});
    expect(themeToCssVars(null)).toEqual({});
  });

  it("aplica as variáveis no documento", () => {
    const el = document.createElement("div");
    applyTheme({ colors: { background: "#f4f6f9" } }, el);
    expect(el.style.getPropertyValue("--org-background")).toBe("#f4f6f9");
  });
});
