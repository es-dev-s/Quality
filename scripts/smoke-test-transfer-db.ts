/**
 * Live DB smoke test for agent transfer + training-supervisor rollout.
 * Run: npx tsx scripts/smoke-test-transfer-db.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { SYSTEM_ROLE_DEFINITIONS } from "@/lib/permissions";

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name} — ${detail}`);
}

async function main() {
  console.log("=== DB smoke test: agent transfer + training supervisor ===\n");

  try {
    await prisma.$queryRaw`SELECT 1`;
    record("Database connection", true, "PostgreSQL reachable");
  } catch (error) {
    record(
      "Database connection",
      false,
      error instanceof Error ? error.message : String(error)
    );
    summarize();
    process.exit(1);
  }

  const trainingRole = await prisma.role.findUnique({
    where: { slug: SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR },
    include: { scopes: { include: { scope: true } } },
  });
  record(
    "training-supervisor role in DB",
    Boolean(trainingRole),
    trainingRole
      ? `id=${trainingRole.id}, scopes=${trainingRole.scopes.length}`
      : "Role missing — run npm run db:seed:rbac"
  );

  const expectedPerms =
    SYSTEM_ROLE_DEFINITIONS[SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR].permissions;
  if (trainingRole) {
    const dbSlugs = new Set(trainingRole.scopes.map((s) => s.scope.slug));
    const missing = expectedPerms.filter((p) => !dbSlugs.has(p));
    record(
      "training-supervisor permissions",
      missing.length === 0,
      missing.length === 0
        ? `${expectedPerms.length} permissions synced`
        : `Missing: ${missing.join(", ")}`
    );
  }

  const supervisorRole = await prisma.role.findUnique({
    where: { slug: SYSTEM_ROLE_SLUGS.SUPERVISOR },
    include: { scopes: { include: { scope: true } } },
  });
  if (supervisorRole) {
    const hasAuditForm = supervisorRole.scopes.some(
      (s) => s.scope.slug === "audit-form:read"
    );
    record(
      "standard supervisor has audit form",
      hasAuditForm,
      hasAuditForm ? "Correct" : "Missing audit-form:read on supervisor — run npm run db:seed:rbac"
    );
  }

  const transferColumns = await prisma.$queryRaw<
    { column_name: string }[]
  >`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'agent_transfers'
    ORDER BY column_name
  `;
  const colSet = new Set(transferColumns.map((c) => c.column_name));
  const requiredCols = [
    "status",
    "assigned_reviewer_id",
    "requested_at",
    "reviewed_by_id",
    "reviewed_at",
    "review_note",
    "transferred_at",
  ];
  const missingCols = requiredCols.filter((c) => !colSet.has(c));
  record(
    "agent_transfers approval columns",
    missingCols.length === 0,
    missingCols.length === 0
      ? `${colSet.size} columns present`
      : `Missing: ${missingCols.join(", ")}`
  );

  const historyColumns = await prisma.$queryRaw<
    { column_name: string }[]
  >`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'AuditSubmission'
      AND column_name IN ('is_history', 'history_owner_id', 'history_transfer_id')
  `;
  record(
    "audit_submissions history columns",
    historyColumns.length === 3,
    `Found ${historyColumns.length}/3 history columns`
  );

  const pendingIndex = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'agent_transfers'
      AND indexname = 'agent_transfers_one_pending_per_agent_idx'
  `;
  record(
    "One pending transfer per agent index",
    pendingIndex.length === 1,
    pendingIndex.length === 1
      ? "Unique partial index exists"
      : "Index missing — run prisma migrate deploy"
  );

  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.agentTransfer.count({ where: { status: "PENDING" } }),
    prisma.agentTransfer.count({ where: { status: "APPROVED" } }),
    prisma.agentTransfer.count({ where: { status: "REJECTED" } }),
  ]);
  record(
    "agent_transfers data readable",
    true,
    `PENDING=${pendingCount}, APPROVED=${approvedCount}, REJECTED=${rejectedCount}`
  );

  const historyAuditCount = await prisma.auditSubmission.count({
    where: { isHistory: true },
  });
  record(
    "history audits queryable",
    true,
    `${historyAuditCount} history audit(s) in DB`
  );

  const trainingSupervisorUsers = await prisma.user.count({
    where: {
      role: { slug: SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR },
      isActive: true,
      approvalStatus: "ACTIVE",
    },
  });
  record(
    "training supervisor users (informational)",
    true,
    `${trainingSupervisorUsers} active user(s) — assign Learn Lab users if 0`
  );

  const orphanPending = await prisma.agentTransfer.findMany({
    where: {
      status: "PENDING",
      agentUser: { createdById: { not: undefined } },
    },
    select: {
      id: true,
      fromSupervisorId: true,
      agentUser: { select: { createdById: true, name: true } },
    },
    take: 20,
  });
  const stalePending = orphanPending.filter(
    (row) => row.agentUser.createdById !== row.fromSupervisorId
  );
  record(
    "pending transfers match current ownership",
    stalePending.length === 0,
    stalePending.length === 0
      ? "No stale pending rows"
      : `${stalePending.length} pending row(s) where agent supervisor already changed`
  );

  summarize();
  process.exit(checks.some((c) => !c.ok) ? 1 : 0);
}

function summarize() {
  const failed = checks.filter((c) => !c.ok);
  console.log("\n=== Summary ===");
  console.log(`Total: ${checks.length}, Passed: ${checks.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.detail}`);
    }
  } else {
    console.log("\nAll DB smoke checks passed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
