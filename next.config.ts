import type { NextConfig } from "next";
import {
  collectAllowedOrigins,
  collectDevAllowedOrigins,
} from "./lib/deployment-origins";

const allowedOrigins = collectAllowedOrigins();

const nextConfig: NextConfig = {
  allowedDevOrigins: collectDevAllowedOrigins(),
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
