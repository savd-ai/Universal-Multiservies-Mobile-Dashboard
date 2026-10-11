import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // `server-only` throws when imported outside a React Server environment; tests import server modules directly.
      "server-only": path.resolve(root, "tests/stubs/empty.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", ".claude/**"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    env: {
      DATA_DIR: "",
      STORE_DRIVER: "memory",
      // unit tests call services and route handlers directly; auth tests switch this to "required"
      AUTH_MODE: "off",
    },
  },
});
