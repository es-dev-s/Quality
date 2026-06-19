/**
 * One-time migration: move audit uploads from public/uploads/ to storage/uploads/.
 *
 * Usage: npx tsx scripts/migrate-uploads.ts
 */
import { mkdir, readdir, rename, stat } from "fs/promises";
import path from "path";

const PAIRS = [
  {
    from: "public/uploads/audit-images",
    to: "storage/uploads/audit-images",
  },
  {
    from: "public/uploads/audit-media",
    to: "storage/uploads/audit-media",
  },
] as const;

async function migrateDirectory(fromRel: string, toRel: string) {
  const fromDir = path.join(process.cwd(), fromRel);
  const toDir = path.join(process.cwd(), toRel);

  let entries: string[];
  try {
    entries = await readdir(fromDir);
  } catch {
    console.info(`[skip] Source missing: ${fromRel}`);
    return;
  }

  await mkdir(toDir, { recursive: true });

  for (const name of entries) {
    if (name === ".gitkeep") continue;

    const fromPath = path.join(fromDir, name);
    const toPath = path.join(toDir, name);

    const info = await stat(fromPath);
    if (!info.isFile()) continue;

    try {
      await stat(toPath);
      console.info(`[skip] Already exists: ${toRel}/${name}`);
      continue;
    } catch {
      // destination does not exist — proceed
    }

    await rename(fromPath, toPath);
    console.info(`[moved] ${fromRel}/${name} → ${toRel}/${name}`);
  }
}

async function main() {
  for (const pair of PAIRS) {
    await migrateDirectory(pair.from, pair.to);
  }
  console.info("Migration complete.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
