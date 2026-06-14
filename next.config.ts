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
}

const nextConfig: NextConfig = {
  allowedDevOrigins: collectDevAllowedOrigins(),
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
