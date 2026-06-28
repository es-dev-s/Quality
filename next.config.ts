import type { NextConfig } from "next";
import {
  collectAllowedOrigins,
  collectDevAllowedOrigins,
} from "./lib/deployment-origins";

function shouldTrustHostAtBuild(): boolean {
  const flag = process.env.AUTH_TRUST_HOST?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

const trustHostAtBuild = shouldTrustHostAtBuild();
// When trusting Host / X-Forwarded-* at runtime, Server Actions rely on same-origin
// checks — no fixed allowlist required (supports new domains without rebuild).
const allowedOrigins = trustHostAtBuild ? undefined : collectAllowedOrigins();

if (process.env.NODE_ENV === "production") {
  console.info(
    trustHostAtBuild
      ? "[deploy] Server Actions: trust-host mode (same-origin, no fixed allowlist)"
      : `[deploy] Server Action allowedOrigins (${allowedOrigins!.length}): ${allowedOrigins!.join(", ")}`
  );
  console.info(
    `[deploy] AUTH_SECURE_COOKIES=${process.env.AUTH_SECURE_COOKIES ?? "unset"} APP_URL=${process.env.APP_URL ?? "unset"} AUTH_TRUST_HOST=${process.env.AUTH_TRUST_HOST ?? "(production default: true)"}`
  );
} else {
  console.info(
    `[dev] LAN Server Action origins (${collectAllowedOrigins().length}): ${collectAllowedOrigins().slice(0, 8).join(", ")}${collectAllowedOrigins().length > 8 ? "…" : ""}`
  );
}

const nextConfig: NextConfig = {
  allowedDevOrigins: collectDevAllowedOrigins(),
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
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      ...(allowedOrigins ? { allowedOrigins } : {}),
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
