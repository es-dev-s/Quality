/**
 * Redirect URL regression — browser host wins over APP_URL when trusted.
 * Run: npx tsx scripts/verify-request-url.ts
 */
import { resolveRedirectUrl, resolveRequestOrigin } from "@/lib/request-url";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

process.env.APP_URL = "http://10.80.80.221:4782";
process.env.AUTH_TRUST_HOST = "true";
process.env.PORT = "4782";

const localhostRequest = new URL("http://localhost:4782/login");

assert(
  resolveRequestOrigin(localhostRequest) === "http://localhost:4782",
  "localhost origin detected"
);
assert(
  resolveRedirectUrl("/dashboard", localhostRequest).href ===
    "http://localhost:4782/dashboard",
  "localhost login redirect stays on localhost"
);

const lanRequest = new URL("http://10.80.80.221:4782/login");

assert(
  resolveRedirectUrl("/dashboard", lanRequest).href ===
    "http://10.80.80.221:4782/dashboard",
  "LAN IP redirect stays on LAN IP"
);

console.log("verify-request-url: OK");
