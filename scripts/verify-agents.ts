import "dotenv/config";
import { ensureDefaultAgents, fetchAllAgents } from "@/lib/audit/agent-db";
import { AGENTS } from "@/lib/audit/seed-data";
import { prisma } from "@/lib/prisma";

async function main() {
  await ensureDefaultAgents();
  const agents = await fetchAllAgents();

  console.log(`\nAgents in DB: ${agents.length} (seed list: ${AGENTS.length})`);
  console.log(
    `Active: ${agents.filter((a) => a.isActive).length}, with DOJ: ${agents.filter((a) => a.dateOfJoining).length}\n`
  );

  for (const agent of agents) {
    console.log(
      `- ${agent.name} | DOJ: ${agent.dateOfJoining ?? "—"} | ${agent.isActive ? "active" : "inactive"}`
    );
  }

  const missingFromDb = AGENTS.filter(
    (name) => !agents.some((a) => a.name.toLowerCase() === name.toLowerCase())
  );

  if (agents.length === 0) {
    console.error("\nNo agents in DB.");
    process.exitCode = 1;
  } else if (missingFromDb.length > 0) {
    console.warn(
      "\nLegacy seed names not in roster (OK when using agent.md import):",
      missingFromDb.join(", ")
    );
    console.log(`\n${agents.length} agent(s) verified in DB.`);
  } else {
    console.log("\nAll seed agents present in DB.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
