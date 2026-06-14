import os from "os";
import { collectConfiguredOrigins, getPort, isProduction } from "./deployment";

/** Private LAN IPv4 addresses (Node.js only — used at build/dev config time). */
export function getLanIpv4Hosts(): string[] {
  const port = getPort();
  const hosts: string[] = [];

  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        hosts.push(`${addr.address}:${port}`);
        hosts.push(addr.address);
      }
    }
  }

  return hosts;
}

export function collectAllowedOrigins(): string[] {
  const origins = new Set(collectConfiguredOrigins());

  if (!isProduction()) {
    for (const host of getLanIpv4Hosts()) {
      origins.add(host);
    }
  }

  return Array.from(origins);
}

export function collectDevAllowedOrigins(): string[] | undefined {
  if (isProduction()) return undefined;
  return collectAllowedOrigins();
}
