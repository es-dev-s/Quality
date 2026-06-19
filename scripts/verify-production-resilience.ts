/**
 * Production resilience gate — runs offline checks (no running server required).
 * Run: npx tsx scripts/verify-production-resilience.ts
 */
import { spawnSync } from "node:child_process";
import { checkRateLimit } from "@/lib/server/rate-limit";

type SuiteResult = { name: string; ok: boolean; detail: string };

const results: SuiteResult[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

function runScript(relativePath: string, name: string) {
  const child = spawnSync("npx", ["tsx", relativePath], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
  const output = [child.stdout, child.stderr].filter(Boolean).join("\n").trim();
  const tail = output.split("\n").slice(-8).join("\n");
  record(name, child.status === 0, tail || `exit ${child.status ?? "unknown"}`);
}

function testRateLimiter() {
  const key = `resilience-test:${Date.now()}`;
  let blocked = false;
  for (let i = 0; i < 5; i++) {
    const result = checkRateLimit(key, 3, 60_000);
    if (!result.allowed) blocked = true;
  }
  record(
    "Write rate limiter",
    blocked,
    blocked
      ? "Token bucket blocks after limit (3/60s test window)"
      : "Expected rate limit to block burst requests"
  );
}

async function main() {
  console.log("\n=== Production resilience verification ===\n");

  runScript("scripts/verify-audit-spec.ts", "Audit rubric spec");
  runScript("scripts/verify-platform.ts", "Platform / DB integrity");
  runScript("scripts/verify-interaction-config.ts", "Interaction config");
  runScript("scripts/verify-agents.ts", "Agent roster");
  runScript("scripts/verify-agent-roster.ts", "Agent roster file parse");
  runScript("scripts/verify-lan-config.ts", "LAN / HTTP config");

  testRateLimiter();

  console.log("Results:\n");
  let failed = 0;
  for (const row of results) {
    const icon = row.ok ? "✓" : "✗";
    console.log(`  ${icon} ${row.name}`);
    console.log(`    ${row.detail.replace(/\n/g, "\n    ")}\n`);
    if (!row.ok) failed += 1;
  }

  console.log(`${results.length - failed}/${results.length} suites passed.\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
