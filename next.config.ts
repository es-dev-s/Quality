import type { NextConfig } from "next";
import {
  collectAllowedOrigins,
  collectDevAllowedOrigins,
} from "./lib/deployment-origins";

const allowedOrigins = collectAllowedOrigins();

if (process.env.NODE_ENV === "production") {
  console.info(
    `[deploy] Server Action allowedOrigins (${allowedOrigins.length}): ${allowedOrigins.join(", ")}`
  );
  console.info(
    `[deploy] AUTH_SECURE_COOKIES=${process.env.AUTH_SECURE_COOKIES ?? "unset"} APP_URL=${process.env.APP_URL ?? "unset"}`
  );
}

const nextConfig: NextConfig = {
  allowedDevOrigins: collectDevAllowedOrigins(),
  // Inlined at build time so middleware (edge) matches server auth cookie settings.
  env: {
    AUTH_SECURE_COOKIES: process.env.AUTH_SECURE_COOKIES ?? "false",
    APP_URL: process.env.APP_URL ?? "",
    AUTH_URL: process.env.AUTH_URL ?? "",
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "true",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // TODO: Add Content-Security-Policy after inline script audit.
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
