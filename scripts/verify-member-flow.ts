/**
 * End-to-end Member create + grant/revoke + scope smoke checks.
 * Run: npx tsx scripts/verify-member-flow.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLE_DEFINITIONS, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import {
  fetchMemberAccessGrants,
  fetchMemberGrantedTargetUserIds,
  resolveMemberFeedbackMode,
} from "@/lib/audit/member-access";
import { auditSubmissionScopeWhere } from "@/lib/audit/data-scope";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const TEST_EMAIL = `member.verify.${Date.now()}@example.com`;
const TEST_PASSWORD = "VerifyMember1!";

async function main() {
  console.log("=== Member flow verification ===\n");

  const memberRole = await prisma.role.findUnique({
    where: { slug: SYSTEM_ROLE_SLUGS.MEMBER },
    include: { scopes: { include: { scope: true } } },
  });
  assert(!!memberRole, "Member role missing — run npm run db:seed:rbac");

  const scopeSlugs = new Set(memberRole!.scopes.map((s) => s.scope.slug));
  const expected = SYSTEM_ROLE_DEFINITIONS[SYSTEM_ROLE_SLUGS.MEMBER].permissions;
  for (const perm of expected) {
    assert(scopeSlugs.has(perm), `Member missing scope ${perm}`);
  }
  assert(!scopeSlugs.has("audit-form:read"), "Member should not have form read");
  assert(!scopeSlugs.has("audit-form:write"), "Member should not have form write");
  console.log("✓ Member role scopes OK");

  const qmPerm = await prisma.role.findUnique({
    where: { slug: SYSTEM_ROLE_SLUGS.QUALITY_MANAGER },
    include: { scopes: { include: { scope: true } } },
  });
  assert(
    !!qmPerm?.scopes.some((s) => s.scope.slug === "users:member-access"),
    "QM missing users:member-access"
  );
  console.log("✓ QM has users:member-access");

  const agent = await prisma.user.findFirst({
    where: {
      role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
      isActive: true,
      approvalStatus: "ACTIVE",
    },
    select: { id: true, name: true, email: true },
  });
  const qa = await prisma.user.findFirst({
    where: {
      role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST },
      isActive: true,
      approvalStatus: "ACTIVE",
    },
    select: { id: true, name: true, email: true },
  });
  assert(!!agent, "Need at least one active Agent to verify grants");
  assert(!!qa, "Need at least one active QA to verify grants");
  console.log(`✓ Grant targets: agent=${agent!.email}, qa=${qa!.email}`);

  const grantor =
    (await prisma.user.findFirst({
      where: {
        role: { slug: SYSTEM_ROLE_SLUGS.SUPERADMIN },
        isActive: true,
      },
      select: { id: true, email: true },
    })) ??
    (await prisma.user.findFirst({
      where: {
        role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_MANAGER },
        isActive: true,
      },
      select: { id: true, email: true },
    }));
  assert(!!grantor, "Need Superadmin or QM as grantor");

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const member = await prisma.user.create({
    data: {
      name: "Verify Member",
      email: TEST_EMAIL,
      password: passwordHash,
      roleId: memberRole!.id,
      createdById: grantor!.id,
      isActive: true,
      approvalStatus: "ACTIVE",
    },
    select: { id: true, email: true },
  });
  console.log(`✓ Created member ${member.email}`);

  try {
    const emptyIds = await fetchMemberGrantedTargetUserIds(member.id);
    assert(
      emptyIds.agentIds.length === 0 && emptyIds.qaIds.length === 0,
      "New member should have zero grants"
    );
    assert(
      (await resolveMemberFeedbackMode(member.id)) === "none",
      "Feedback mode should be none"
    );

    const emptyScope = await auditSubmissionScopeWhere({
      userId: member.id,
      userName: "Verify Member",
      userEmail: member.email,
      role: {
        id: memberRole!.id,
        name: "Member",
        slug: SYSTEM_ROLE_SLUGS.MEMBER,
        scopes: [...expected],
      },
    });
    assert(
      !!emptyScope &&
        "id" in emptyScope &&
        emptyScope.id === "__no_access__",
      "Zero grants must deny all audit rows"
    );
    console.log("✓ Empty grants → noAccessFilter");

    await prisma.memberAccessGrant.create({
      data: {
        memberId: member.id,
        targetUserId: agent!.id,
        grantedById: grantor!.id,
      },
    });
    await prisma.memberAccessGrant.create({
      data: {
        memberId: member.id,
        targetUserId: qa!.id,
        grantedById: grantor!.id,
      },
    });

    const grants = await fetchMemberAccessGrants(member.id);
    assert(grants.length === 2, `Expected 2 grants, got ${grants.length}`);
    assert(
      grants.some((g) => g.targetRoleSlug === SYSTEM_ROLE_SLUGS.AGENT),
      "Missing Agent grant"
    );
    assert(
      grants.some((g) => g.targetRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST),
      "Missing QA grant"
    );
    console.log("✓ Granted Agent + QA");

    const ids = await fetchMemberGrantedTargetUserIds(member.id);
    assert(ids.agentIds.includes(agent!.id), "Agent id missing from grants");
    assert(ids.qaIds.includes(qa!.id), "QA id missing from grants");
    assert(
      (await resolveMemberFeedbackMode(member.id)) === "qa",
      "Any QA grant should set feedback mode qa"
    );

    const grantedScope = await auditSubmissionScopeWhere({
      userId: member.id,
      userName: "Verify Member",
      userEmail: member.email,
      role: {
        id: memberRole!.id,
        name: "Member",
        slug: SYSTEM_ROLE_SLUGS.MEMBER,
        scopes: [...expected],
      },
    });
    assert(
      !!grantedScope &&
        (!("id" in grantedScope) || grantedScope.id !== "__no_access__"),
      "With grants, scope must not be noAccessFilter"
    );
    console.log("✓ Granted scope composed (OR of Agent/QA clauses)");

    // Duplicate grant must fail uniquely
    let duplicateBlocked = false;
    try {
      await prisma.memberAccessGrant.create({
        data: {
          memberId: member.id,
          targetUserId: agent!.id,
          grantedById: grantor!.id,
        },
      });
    } catch {
      duplicateBlocked = true;
    }
    assert(duplicateBlocked, "Duplicate (memberId, targetUserId) must be unique");
    console.log("✓ Unique grant constraint OK");

    const agentGrant = grants.find(
      (g) => g.targetRoleSlug === SYSTEM_ROLE_SLUGS.AGENT
    )!;
    await prisma.memberAccessGrant.delete({ where: { id: agentGrant.id } });
    const afterAgentRevoke = await fetchMemberGrantedTargetUserIds(member.id);
    assert(afterAgentRevoke.agentIds.length === 0, "Agent grant not revoked");
    assert(afterAgentRevoke.qaIds.length === 1, "QA grant should remain");
    assert(
      (await resolveMemberFeedbackMode(member.id)) === "qa",
      "Still QA mode with QA grant"
    );
    console.log("✓ Revoke Agent keeps QA grant");

    await prisma.memberAccessGrant.deleteMany({ where: { memberId: member.id } });
    const afterAll = await fetchMemberGrantedTargetUserIds(member.id);
    assert(
      afterAll.agentIds.length === 0 && afterAll.qaIds.length === 0,
      "All grants should be gone"
    );
    assert(
      (await resolveMemberFeedbackMode(member.id)) === "none",
      "Feedback mode none after revoke all"
    );
    const deniedAgain = await auditSubmissionScopeWhere({
      userId: member.id,
      userName: "Verify Member",
      userEmail: member.email,
      role: {
        id: memberRole!.id,
        name: "Member",
        slug: SYSTEM_ROLE_SLUGS.MEMBER,
        scopes: [...expected],
      },
    });
    assert(
      !!deniedAgain &&
        "id" in deniedAgain &&
        deniedAgain.id === "__no_access__",
      "After revoke all, scope denies again"
    );
    console.log("✓ Revoke all → empty scope again");

    // Agent-only feedback mode
    await prisma.memberAccessGrant.create({
      data: {
        memberId: member.id,
        targetUserId: agent!.id,
        grantedById: grantor!.id,
      },
    });
    assert(
      (await resolveMemberFeedbackMode(member.id)) === "agent",
      "Agent-only grants → agent feedback mode"
    );
    console.log("✓ Agent-only feedback mode");

    console.log("\n=== All Member flow checks passed ===");
  } finally {
    await prisma.memberAccessGrant.deleteMany({ where: { memberId: member.id } });
    await prisma.user.delete({ where: { id: member.id } }).catch(() => undefined);
    console.log("✓ Cleanup test member");
  }
}

main()
  .catch((error) => {
    console.error("\nVERIFY FAILED:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
