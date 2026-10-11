import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Architecture guard: browser code must never import server-only modules or AI SDKs.
    files: ["src/components/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}", "src/stores/**/*.{ts,tsx}", "src/lib/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/server/*", "@/lib/server/**"], message: "Server-only module: call it through an API route." },
            { group: ["@anthropic-ai/sdk", "openai", "@google/genai", "undici"], message: "Provider SDKs are server-only." },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "data/**", "coverage/**", ".claude/**"]),
]);

export default eslintConfig;
