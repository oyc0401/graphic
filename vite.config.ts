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

});
