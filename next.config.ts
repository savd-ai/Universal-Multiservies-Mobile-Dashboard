import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image small (see Dockerfile).
  output: "standalone",
  // Provider SDKs and the HTTP client stay in node_modules on the server; they are never bundled for the browser.
  serverExternalPackages: ["@anthropic-ai/sdk", "openai", "@google/genai", "undici"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
