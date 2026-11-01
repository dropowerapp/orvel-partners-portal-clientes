// Garante que todas as chaves de tradução usadas no código existem em pt-PT.json, e que não há
// texto visível escrito diretamente nos componentes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ptPT from "./pt-PT.json";

const SRC = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function has(key: string): boolean {
  let node: unknown = ptPT;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}

describe("traduções", () => {
  const sources = files(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

  it("todas as chaves t(\"…\") usadas existem", () => {
    const missing: string[] = [];
    for (const { path, text } of sources) {
      for (const match of text.matchAll(/\bt\(\s*"([a-z_]+\.[a-z_.]+)"/g)) {
        if (!has(match[1])) missing.push(`${path.replace(SRC, "")}: ${match[1]}`);
      }
      for (const match of text.matchAll(/"((?:errors|client_login|privacy)\.[a-z_]+)"/g)) {
        if (!has(match[1])) missing.push(`${path.replace(SRC, "")}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("componentes sem texto visível escrito diretamente (tudo nos ficheiros de tradução)", () => {
    const offenders: string[] = [];
    for (const { path, text } of sources.filter((s) => s.path.endsWith(".tsx"))) {
      // Texto entre > e < com letras, fora de expressões {…}.
      for (const match of text.matchAll(/(?<!=)>\s*([A-Za-zÀ-ÿ][^<>{}]*[A-Za-zÀ-ÿ.!?])\s*</g)) {
        offenders.push(`${path.replace(SRC, "")}: ${match[1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
