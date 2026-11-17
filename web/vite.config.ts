/// <reference types="vitest/config" />
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const BRANDING_DIR = resolve(import.meta.dirname, "../branding");

/**
 * Só na demonstração: ficheiros da marca (../branding) em /demo-branding. No servidor de
 * desenvolvimento são servidos diretamente; num build de demonstração (VITE_DEMO_MODE=true) são
 * copiados para dist/demo-branding. Nos builds normais este plugin não existe.
 */
function demoBranding(): Plugin {
  const dir = BRANDING_DIR;
  const files = (folder: string): string[] =>
    readdirSync(folder).flatMap((name) => {
      const path = join(folder, name);
      return statSync(path).isDirectory() ? files(path) : IMAGE_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ? [path] : [];
    });
  return {
    name: "demo-branding",
    configureServer(server) {
      server.middlewares.use("/demo-branding", (req, res, next) => {
        const file = resolve(dir, decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\/+/, ""));
        const type = IMAGE_TYPES[file.split(".").pop()?.toLowerCase() ?? ""];
        if (!file.startsWith(dir + sep) || !type || !existsSync(file)) return next();
        res.setHeader("content-type", type);
        createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const file of files(dir).filter((f) => !f.includes(`${sep}originais${sep}`))) {
        this.emitFile({
          type: "asset",
          fileName: `demo-branding/${relative(dir, file).split(sep).join("/")}`,
          source: readFileSync(file),
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  // Modo de demonstração (dados fictícios): aceita qualquer endereço, para a pré-visualização
  // poder chegar ao servidor de desenvolvimento por um proxy. Fora dele, só localhost.
  // Mesma condição que src/lib/demoMode.ts.
  const demo = mode === "demo" || env.VITE_DEMO_MODE === "true";
  return {
    plugins: [react(), tailwindcss(), ...(demo ? [demoBranding()] : [])],
    server: { port: 5173, strictPort: true, ...(demo ? { allowedHosts: true as const } : {}) },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
