import os from "os";
import { collectConfiguredOrigins, getPort, isProduction } from "./deployment";

function isIpv4Family(family: string | number): boolean {
  return family === "IPv4" || family === 4;
}

/** Private LAN IPv4 addresses (Node.js only — used at build/dev config time). */
export function getLanIpv4Hosts(): string[] {
  const port = getPort();
  const hosts: string[] = [];

  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const addr of iface) {
      // Node may report family as "IPv4" or 4 depending on version/options.
      if (isIpv4Family(addr.family) && !addr.internal) {
        hosts.push(`${addr.address}:${port}`);
        hosts.push(addr.address);
      }
    }
  }

  return hosts;
}

/** Primary shareable LAN URL for phones/tablets on the same Wi‑Fi. */
export function getPrimaryLanUrl(): string | null {
  const port = getPort();
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const addr of iface) {
      if (!isIpv4Family(addr.family) || addr.internal) continue;
      return `http://${addr.address}:${port}`;
    }
  }
  return null;
}

export function collectAllowedOrigins(): string[] {
  const origins = new Set(collectConfiguredOrigins());

  // Include this machine's LAN IPs in production too (e.g. http://10.80.80.221:4782).
  // Without this, Server Actions fail on LAN-hosted Windows Server builds.
  for (const host of getLanIpv4Hosts()) {
    origins.add(host);
  }

  return Array.from(origins);
}

export function collectDevAllowedOrigins(): string[] | undefined {
  if (isProduction()) return undefined;
  return collectAllowedOrigins();
}
