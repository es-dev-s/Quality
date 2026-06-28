/**
 * Custom-domain redirect regression — must stay on browser host, not APP_URL localhost.
 * Run: npx tsx scripts/verify-domain-redirect.ts
 */
import { resolveRedirectUrl, resolveRequestOrigin } from "@/lib/request-url";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function domainRequest() {
  return new URL("https://qa.example.com/login");
}

function forwardedDomainRequest() {
  return {
    nextUrl: new URL("http://127.0.0.1:4782/login"),
    headers: new Headers({
      "x-forwarded-host": "qa.example.com",
      "x-forwarded-proto": "https",
    }),
  };
}

// Misconfigured production: APP_URL still localhost, domain not in ALLOWED_ORIGINS
process.env.APP_URL = "http://localhost:4782";
process.env.PORT = "4782";
delete process.env.ALLOWED_ORIGINS;
process.env.AUTH_TRUST_HOST = "true";

const origin = resolveRequestOrigin(domainRequest());
const redirect = resolveRedirectUrl("/dashboard", domainRequest());

console.log("Scenario: APP_URL=localhost, visit https://qa.example.com");
console.log("  resolveRequestOrigin:", origin);
console.log("  resolveRedirectUrl:  ", redirect.href);

assert(
  origin === "https://qa.example.com",
  "expected domain origin with trust-host production mode"
);
assert(
  redirect.href === "https://qa.example.com/dashboard",
  "expected redirect to stay on custom domain"
);

const proxyOrigin = resolveRequestOrigin(forwardedDomainRequest());
const proxyRedirect = resolveRedirectUrl("/dashboard", forwardedDomainRequest());

console.log("\nScenario: reverse proxy forwards qa.example.com");
console.log("  resolveRequestOrigin:", proxyOrigin);
console.log("  resolveRedirectUrl:  ", proxyRedirect.href);

assert(
  proxyOrigin === "https://qa.example.com",
  "expected forwarded host origin"
);
assert(
  proxyRedirect.href === "https://qa.example.com/dashboard",
  "expected proxy redirect on custom domain"
);

// Explicit APP_URL matching domain still works
process.env.APP_URL = "https://qa.example.com";
process.env.ALLOWED_ORIGINS = "qa.example.com";

const fixedOrigin = resolveRequestOrigin(domainRequest());
const fixedRedirect = resolveRedirectUrl("/dashboard", domainRequest());

console.log("\nScenario: APP_URL=https://qa.example.com + ALLOWED_ORIGINS");
console.log("  resolveRequestOrigin:", fixedOrigin);
console.log("  resolveRedirectUrl:  ", fixedRedirect.href);

assert(fixedOrigin === "https://qa.example.com", "configured domain origin");
assert(
  fixedRedirect.href === "https://qa.example.com/dashboard",
  "configured domain redirect"
);

console.log("\nverify-domain-redirect: OK");
