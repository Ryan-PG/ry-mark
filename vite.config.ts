import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { devAuthPlugin } from "./dev-server/dev-auth.ts";

// Ry-Mark Vite configuration.
//
// - The frontend is a standard React SPA bundled from src/.
// - content/ is synced into public/content by scripts/build-content.mjs
//   (npm predev / prebuild hooks) so the SPA can fetch it at runtime.
// - In `vite dev` / `vite preview` the /api/auth/* endpoints and /healthz are
//   emulated by a local middleware (dev-server/dev-auth.ts) that uses the
//   SAME shared auth core as the Cloudflare worker and the Node server.
//   It reads .dev.vars (see .dev.vars.example) when present.
export default defineConfig({
  plugins: [react(), tailwindcss(), devAuthPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
