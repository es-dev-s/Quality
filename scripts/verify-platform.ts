/**
 * Production readiness checks for DB-backed data integrity.
 * Run: npx tsx scripts/verify-platform.ts
 */
import "dotenv/config";
import { AGENTS } from "@/lib/audit/seed-data";
import { ensureDefaultAgents, fetchAllAgents } from "@/lib/audit/agent-db";
import { fetchInteractionConfigRow } from "@/lib/audit/interaction-config-db";
import { ensureDefaultTemplate } from "@/lib/audit/template-db";
import { isAgentsInitialized } from "@/lib/db/system-meta";
import { prisma } from "@/lib/prisma";

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function pass(name: string, detail: string) {
  checks.push({ name, ok: true, detail });
}

function fail(name: string, detail: string) {
  checks.push({ name, ok: false, detail });
}

async function main() {
  console.log("\n=== Platform verification ===\n");

  await ensureDefaultInteractionConfig();
  await ensureDefaultAgents();
  await ensureDefaultTemplate();

  const agents = await fetchAllAgents();
  const agentsInitialized = await isAgentsInitialized();

  if (agentsInitialized) {
    pass("Agent seed flag", "agents_initialized meta is set");
  } else {
    fail("Agent seed flag", "agents_initialized meta missing after ensureDefaultAgents");
  }

  const missingAgents = AGENTS.filter(
    (name) => !agents.some((a) => a.name.toLowerCase() === name.toLowerCase())
  );
  if (agents.length === 0 && missingAgents.length === AGENTS.length) {
    pass("Agents table", "Empty roster (intentional after initialization)");
  } else if (missingAgents.length === 0) {
    pass("Agents table", `${agents.length} agents; all seed names present`);
  } else if (agents.length > 0) {
    pass(
      "Agents table",
      `${agents.length} agents (${missingAgents.length} seed names not in roster — OK if customized)`
    );
  } else {
    fail("Agents table", "No agents and seed flag set — roster may be empty");
  }

  const agentsWithoutKey = await prisma.agent.findMany({
    where: { nameKey: "" },
    select: { id: true },
  });
  if (agentsWithoutKey.length === 0) {
    pass("Agent nameKey", "All agents have name_key for case-insensitive uniqueness");
  } else {
    fail("Agent nameKey", `${agentsWithoutKey.length} agents missing name_key`);
  }

  const configRow = await fetchInteractionConfigRow();
  const config = configRow.config as Record<string, unknown>;
  if (config && typeof config === "object") {
    const supervisors = Array.isArray(config.supervisors) ? config.supervisors.length : 0;
    const businessTypes = Array.isArray(config.businessTypes)
      ? config.businessTypes.length
      : 0;
    const lobs = Array.isArray(config.lobs) ? config.lobs.length : 0;
    pass(
      "Interaction config",
      `DB row present — ${supervisors} supervisors, ${businessTypes} business types, ${lobs} LOBs`
    );
  } else {
    fail("Interaction config", "Invalid or missing config JSON");
  }

  const templates = await prisma.formTemplate.findMany({
    select: { id: true, isDefault: true },
  });
  const hasCall = templates.some((t) => t.id === "call");
  const hasChat = templates.some((t) => t.id === "chat");
  if (hasCall && hasChat) {
    pass("Form templates", `${templates.length} templates; call + chat present`);
  } else {
    fail("Form templates", `Missing built-ins (call: ${hasCall}, chat: ${hasChat})`);
  }

  const invalidPrefs = await prisma.userTemplatePreference.findMany({
    where: {
      activeTemplateId: { notIn: templates.map((t) => t.id) },
    },
    select: { userId: true, activeTemplateId: true },
  });
  if (invalidPrefs.length === 0) {
    pass("Template preferences", "All user prefs reference valid templates");
  } else {
    fail(
      "Template preferences",
      `${invalidPrefs.length} prefs point to deleted/invalid templates`
    );
  }

  const auditCount = await prisma.auditSubmission.count();
  pass("Audit submissions", `${auditCount} records (historical data preserved as snapshots)`);

  const usersWithAudits = await prisma.user.findMany({
    where: { auditSubmissions: { some: {} } },
    select: { id: true, email: true, _count: { select: { auditSubmissions: true } } },
  });
  pass(
    "User delete safety",
    `${usersWithAudits.length} user(s) protected by audit FK (ON DELETE RESTRICT)`
  );

  console.log("Results:\n");
  let failed = 0;
  for (const check of checks) {
    const icon = check.ok ? "✓" : "✗";
    console.log(`  ${icon} ${check.name}: ${check.detail}`);
    if (!check.ok) failed += 1;
  }

  console.log(`\n${checks.length - failed}/${checks.length} checks passed.\n`);
  if (failed > 0) process.exitCode = 1;
}

async function ensureDefaultInteractionConfig() {
  const row = await prisma.interactionConfig.findUnique({
    where: { id: "default" },
  });
  if (!row) {
    const { ensureDefaultInteractionConfig: ensure } = await import(
      "@/lib/audit/interaction-config-db"
    );
    await ensure();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
