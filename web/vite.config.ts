/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  // Modo de demonstração (dados fictícios): aceita qualquer endereço, para a pré-visualização
  // poder chegar ao servidor de desenvolvimento por um proxy. Fora dele, só localhost.
  const demo = mode === "demo" || env.VITE_DEMO_MODE === "true";
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, strictPort: true, ...(demo ? { allowedHosts: true as const } : {}) },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
