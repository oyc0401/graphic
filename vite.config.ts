import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait(), svgr()],
  server: {
    host: "0.0.0.0",
    allowedHosts: [
      "474901b9-b1fa-4d22-8f03-6e9abf61ed38-00-3f3714blflx8h.sisko.replit.dev",
    ],
    hmr: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        en: resolve(__dirname, "locales/en/index.html"),
        ko: resolve(__dirname, "locales/ko/index.html"),
        ja: resolve(__dirname, "locales/ja/index.html"),
        es: resolve(__dirname, "locales/es/index.html"),
        fr: resolve(__dirname, "locales/fr/index.html"),
        de: resolve(__dirname, "locales/de/index.html"),
        zh: resolve(__dirname, "locales/zh/index.html"),
        ru: resolve(__dirname, "locales/ru/index.html"),
      },
    },
  },
});
