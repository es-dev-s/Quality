/**
 * LAN / HTTP deployment checks (offline).
 * Run: npm run lan:check
 */
import { resolveUseSecureCookies } from "@/lib/auth-cookies";
import { getPort, shouldTrustHost } from "@/lib/deployment";
import {
  collectAllowedOrigins,
  getLanIpv4Hosts,
  getPrimaryLanUrl,
} from "@/lib/deployment-origins";

function main() {
  console.log("\n=== LAN / HTTP access configuration ===\n");

  const trustHost = shouldTrustHost();
  const secureCookies = resolveUseSecureCookies();
  const appUrl = process.env.APP_URL?.trim() || process.env.AUTH_URL?.trim() || "";
  const lanHosts = getLanIpv4Hosts();
  const allowed = collectAllowedOrigins();
  const lanUrl = getPrimaryLanUrl();
  const port = getPort();

  console.log(`  AUTH_TRUST_HOST:        ${trustHost ? "true ✓" : "false ✗ (set AUTH_TRUST_HOST=true)"}`);
  console.log(
    `  Secure auth cookies:    ${secureCookies ? "true ✗ (use AUTH_SECURE_COOKIES=false on HTTP LAN)" : "false ✓"}`
  );
  console.log(`  APP_URL:                ${appUrl || "(unset — OK for LAN prototype; browser host is trusted)"}`);
  console.log(`  Detected LAN hosts:     ${lanHosts.length ? lanHosts.join(", ") : "(none — check Wi‑Fi adapter)"}`);
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
      ? "\n✓ LAN configuration looks OK."
      : "\n✗ Fix the items marked above, then restart: npm run dev"
  );

  if (lanUrl) {
    console.log(`\n📱 Open on phones (same Wi‑Fi):\n   ${lanUrl}`);
    console.log(`   ${lanUrl}/login`);
    console.log(`\n💻 This machine:\n   http://localhost:${port}`);
  } else {
    console.log(`\n💻 Local only:\n   http://localhost:${port}`);
  }

  console.log(
    "\nTips: keep npm run dev running; use the LAN IP (not localhost) on other devices;"
  );
  console.log(
    "if phones cannot connect, allow inbound TCP " +
      String(port) +
      " in the OS firewall / disable AP/client isolation on the router.\n"
  );

  if (failed > 0) process.exitCode = 1;
}

main();
