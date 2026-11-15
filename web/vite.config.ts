/// <reference types="vitest/config" />
import { createReadStream, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
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

/** Só na demonstração: serve os ficheiros da marca (../branding) em /demo-branding. Não existe no build. */
function demoBranding(): Plugin {
  const dir = resolve(__dirname, "../branding");
  return {
    name: "demo-branding",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/demo-branding", (req, res, next) => {
        const file = resolve(dir, decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\/+/, ""));
        const type = IMAGE_TYPES[file.split(".").pop()?.toLowerCase() ?? ""];
        if (!file.startsWith(dir + sep) || !type || !existsSync(file)) return next();
        res.setHeader("content-type", type);
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  // Modo de demonstração (dados fictícios): aceita qualquer endereço, para a pré-visualização
  // poder chegar ao servidor de desenvolvimento por um proxy. Fora dele, só localhost.
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
