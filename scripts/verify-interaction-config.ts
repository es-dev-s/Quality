import "dotenv/config";
import { fetchInteractionConfigRow, rowToInteractionConfig } from "@/lib/audit/interaction-config-db";
import { DEFAULT_INTERACTION_CONFIG } from "@/lib/audit/seed-data";
import { getLobSubReasonOptions } from "@/lib/audit/lob-flat-lists";
import { toIsoTimestamp } from "@/lib/db/to-iso-timestamp";
import { prisma } from "@/lib/prisma";

async function main() {
  const row = await fetchInteractionConfigRow();

  if (!row) {
    console.log("❌ No interaction_configs row found.");
    process.exitCode = 1;
    return;
  }

  const parsed = rowToInteractionConfig(row);
  const raw = row.config as Record<string, unknown>;

  console.log("\n=== Interaction Config DB Verification ===\n");
  console.log("Row id:", row.id);
  console.log("updatedAt:", toIsoTimestamp(row.updatedAt));
  console.log("configVersion:", "configVersion" in row ? row.configVersion : "—");
  console.log("Raw JSON keys:", Object.keys(raw).join(", "));

  console.log("\n--- Counts ---");
  console.log("Supervisors:", parsed.supervisors.length);
  console.log("Auditors:", parsed.auditors.length);
  console.log("Business types:", parsed.businessTypes.length, "→", parsed.businessTypes.join(", "));
  console.log("LOBs:", parsed.lobs.length);

  console.log("\n--- Supervisors ---");
  parsed.supervisors.forEach((s) => console.log("  •", s));

  console.log("\n--- Auditors (config list) ---");
  parsed.auditors.forEach((a) => console.log("  •", a));

  console.log("\n--- LOBs (summary) ---");
  for (const lob of parsed.lobs) {
    const reasonCount = getLobSubReasonOptions(lob).length;
    console.log(
      `  • [${lob.businessType}] ${lob.name} — ${lob.sublobs.length} reasons, ${reasonCount} sub-reasons, ${lob.dffList?.length ?? 0} DFF`
    );
  }

  const seed = DEFAULT_INTERACTION_CONFIG;
  console.log("\n--- vs defaults (seed-data.ts) ---");
  console.log(
    "Supervisors:",
    parsed.supervisors.length,
    "in DB vs",
    seed.supervisors.length,
    "default"
  );
  console.log(
    "Auditors:",
    parsed.auditors.length,
    "in DB vs",
    seed.auditors.length,
    "default"
  );
  console.log("LOBs:", parsed.lobs.length, "in DB vs", seed.lobs.length, "default");

  const customSupervisors = parsed.supervisors.filter(
    (s) => !seed.supervisors.some((d) => d.toLowerCase() === s.toLowerCase())
  );
  const customAuditors = parsed.auditors.filter(
    (a) => !seed.auditors.some((d) => d.toLowerCase() === a.toLowerCase())
  );

  if (customSupervisors.length) {
    console.log("\nCustom supervisors (not in default seed):");
    customSupervisors.forEach((s) => console.log("  +", s));
  } else {
    console.log("\nNo custom supervisors beyond defaults.");
  }

  if (customAuditors.length) {
    console.log("\nCustom auditors (not in default seed):");
    customAuditors.forEach((a) => console.log("  +", a));
  } else {
    console.log("\nNo custom auditors beyond defaults.");
  }

  console.log("\n✓ Data is stored in PostgreSQL table `interaction_configs` (id=default).\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
