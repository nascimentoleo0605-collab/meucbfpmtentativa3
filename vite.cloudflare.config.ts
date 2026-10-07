import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    preset: "cloudflare-module",
    cloudflare: { nodeCompat: true },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
