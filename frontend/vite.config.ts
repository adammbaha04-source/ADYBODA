import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // manifest.webmanifest lives in public/, so the plugin does not generate one.
      manifest: false,
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png", "login-hero.jpg", "login-footer.jpg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,jpg,svg,ico}"],
        // Never serve API responses from cache. Money and vehicle data must always be live.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          { urlPattern: /\/api\//, handler: "NetworkOnly" },
        ],
      },
    }),
  ],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
