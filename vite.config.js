import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
//import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    // viteStaticCopy({
    //   targets: [
    //     {
    //       src: "node_modules/@jsquash/png/wasm/png_bg.wasm",
    //       dest: "jsquash",
    //     },
    //   ],
    // }),
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: [
      "474901b9-b1fa-4d22-8f03-6e9abf61ed38-00-3f3714blflx8h.sisko.replit.dev",
    ],
    hmr: false, // Change this line to false disable auto-refreshing.
  },
});
