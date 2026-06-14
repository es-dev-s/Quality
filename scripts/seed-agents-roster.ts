/**
 * One-time seed: import agent roster from agent.md (source of truth).
 *
 * Usage:
 *   npx tsx scripts/seed-agents-roster.ts
 *   npx tsx scripts/seed-agents-roster.ts --deactivate-legacy
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { normalizeAgentName } from "@/lib/audit/agent-name";
import {
  AGENT_ROSTER_FILE,
  parseAgentRosterFromFile,
  parseAgentRosterLines,
} from "@/lib/audit/agent-roster-data";
import { markAgentsInitialized } from "@/lib/db/system-meta";
import { prisma } from "@/lib/prisma";

async function main() {
  const deactivateLegacy = process.argv.includes("--deactivate-legacy");
  const filePath = path.join(process.cwd(), AGENT_ROSTER_FILE);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${AGENT_ROSTER_FILE} at repo root.`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const dataLines = lines.slice(1);

  const { roster, duplicates, skipped } = parseAgentRosterLines(dataLines, {
    rowOffset: 2,
  });

  console.log(`\nSource: ${AGENT_ROSTER_FILE}`);
  console.log(`  Total lines: ${lines.length} (1 header + ${dataLines.length} data rows)`);
  console.log(`  Unique agents: ${roster.length}`);
  if (duplicates.length > 0) {
    console.log(`  Duplicate name rows skipped: ${duplicates.length}`);
    for (const dup of duplicates) {
      console.log(
        `    • ${dup.name} — row ${dup.row} (duplicate of row ${dup.firstRow}, DOJ ${dup.dateOfJoining})`
      );
    }
  }
  if (skipped.length > 0) {
    console.warn("  Skipped lines:", skipped);
  }

  if (roster.length === 0) {
    throw new Error("No agents parsed from roster file.");
  }

  const existingRows = await prisma.agent.findMany({
    select: { id: true, nameKey: true },
  });
  const existingByKey = new Map(existingRows.map((row) => [row.nameKey, row.id]));

  const rosterKeys = new Set<string>();
  let created = 0;
  let updated = 0;

  for (const entry of roster) {
    const { name, nameKey } = normalizeAgentName(entry.name);
    rosterKeys.add(nameKey);

    const existingId = existingByKey.get(nameKey);

    if (existingId) {
      await prisma.agent.update({
        where: { id: existingId },
        data: {
          name,
          dateOfJoining: entry.dateOfJoining,
          isActive: true,
        },
      });
      updated += 1;
    } else {
      await prisma.agent.create({
        data: {
          name,
          nameKey,
          dateOfJoining: entry.dateOfJoining,
          isActive: true,
        },
      });
      created += 1;
    }
  }

  if (deactivateLegacy) {
    const result = await prisma.agent.updateMany({
      where: { NOT: { nameKey: { in: [...rosterKeys] } }, isActive: true },
      data: { isActive: false },
    });

    if (result.count > 0) {
      const legacy = await prisma.agent.findMany({
        where: { NOT: { nameKey: { in: [...rosterKeys] } } },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      console.log(
        `\nDeactivated ${result.count} agent(s) not in roster:\n  ${legacy.map((a) => a.name).join(", ")}`
      );
    }
  }

  await markAgentsInitialized();

  const dbActive = await prisma.agent.count({ where: { isActive: true } });
  const dbWithDoj = await prisma.agent.count({
    where: { dateOfJoining: { not: null }, isActive: true },
  });

  // Verify no duplicate nameKey in DB among active roster
  const activeAgents = await prisma.agent.findMany({
    where: { isActive: true },
    select: { nameKey: true, name: true },
  });
  const keyCounts = new Map<string, number>();
  for (const agent of activeAgents) {
    keyCounts.set(agent.nameKey, (keyCounts.get(agent.nameKey) ?? 0) + 1);
  }
  const dbDupes = [...keyCounts.entries()].filter(([, c]) => c > 1);

  console.log("\nDone.");
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Active in DB: ${dbActive} (expected ${roster.length} unique)`);
  console.log(`  With date of joining: ${dbWithDoj}`);

  if (dbActive !== roster.length) {
    console.warn(
      `\n⚠ Count mismatch: DB has ${dbActive} active agents, roster has ${roster.length} unique names.`
    );
    process.exitCode = 1;
  }
  if (dbDupes.length > 0) {
    console.error("Duplicate nameKey in DB:", dbDupes);
    process.exitCode = 1;
  } else {
    console.log("  No duplicate names in DB.\n");
  }
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
