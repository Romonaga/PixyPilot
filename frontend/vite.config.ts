import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

declare const process: {
  env: Record<string, string | undefined>;
};

const host = process.env.PIXYPILOT_FRONTEND_HOST ?? "127.0.0.1";
const port = Number(process.env.PIXYPILOT_FRONTEND_PORT ?? 5173);
const apiUrl = process.env.PIXYPILOT_API_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  },
  server: {
    host,
    port,
    proxy: {
      "/api": apiUrl,
      "/health": apiUrl
    }
  }
});
