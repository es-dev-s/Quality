/**
 * LAN / HTTP deployment checks (offline).
 * Run: npx tsx scripts/verify-lan-config.ts
 */
import { resolveUseSecureCookies } from "@/lib/auth-cookies";
import { shouldTrustHost } from "@/lib/deployment";
import { collectAllowedOrigins, getLanIpv4Hosts } from "@/lib/deployment-origins";

function main() {
  console.log("\n=== LAN / HTTP access configuration ===\n");

  const trustHost = shouldTrustHost();
  const secureCookies = resolveUseSecureCookies();
  const appUrl = process.env.APP_URL?.trim() || process.env.AUTH_URL?.trim() || "";
  const lanHosts = getLanIpv4Hosts();
  const allowed = collectAllowedOrigins();

  console.log(`  AUTH_TRUST_HOST:        ${trustHost ? "true ✓" : "false ✗ (set AUTH_TRUST_HOST=true)"}`);
  console.log(
    `  Secure auth cookies:    ${secureCookies ? "true ✗ (use AUTH_SECURE_COOKIES=false on HTTP LAN)" : "false ✓"}`
  );
  console.log(`  APP_URL:                ${appUrl || "(unset — OK for LAN dev via IP)"}`);
  console.log(`  Detected LAN hosts:     ${lanHosts.length ? lanHosts.join(", ") : "(none — check network adapter)"}`);
  console.log(`  Server Action origins:  ${allowed.length} configured`);
  console.log(`  Sample origins:         ${allowed.slice(0, 6).join(", ")}${allowed.length > 6 ? "…" : ""}`);

  let failed = 0;
  if (!trustHost) failed += 1;
  if (secureCookies && !appUrl.startsWith("https://")) failed += 1;
  if (!trustHost && process.env.NODE_ENV === "production") {
    console.log(
      "\n  ⚠ AUTH_TRUST_HOST=false in production — custom domains need explicit ALLOWED_ORIGINS + APP_URL"
    );
  }
  if (lanHosts.length === 0) {
    console.log("\n  ⚠ No LAN IPv4 detected — phone/tablet access may need ALLOWED_ORIGINS in .env");
  }

  console.log(
    failed === 0
      ? "\n✓ LAN configuration looks OK. Restart dev server after Wi‑Fi/IP changes.\n"
      : "\n✗ Fix the items marked above, then restart: npm run dev\n"
  );

  if (failed > 0) process.exitCode = 1;
}

main();
