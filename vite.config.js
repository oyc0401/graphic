import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [],
  server: {
    host: "0.0.0.0",
    allowedHosts: [
      "474901b9-b1fa-4d22-8f03-6e9abf61ed38-00-3f3714blflx8h.sisko.replit.dev"
    ],
    hmr: false, // Change this line to false disable auto-refreshing.
  },
});
