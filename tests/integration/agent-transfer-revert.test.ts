/**
 * End-to-end engine test for transfer + revert against a disposable Postgres.
 *
 *   TEST_DATABASE_URL=postgresql://... npx vitest run tests/integration
 *
 * Scenario: agent moves Alpha -> Bravo, Bravo audits the agent, Alpha's QM
 * reverts. The agent must be back in Alpha with Alpha's audits editable again,
 * Bravo's audits held as Bravo history, and the original QA restored.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL?.trim();

describe.skipIf(!TEST_DB)("agent transfer + revert (integration)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const engine = await import("@/lib/agent-transfer/engine");
  const { resolveAuditOwnership } = await import("@/lib/agent-transfer/ownership");
  const { assertAuditNotHistory } = await import("@/lib/audit/history-guard");
  const { filterKpiRecords } = await import("@/lib/kpi/compute-kpi");
  const { DEFAULT_KPI_FILTERS } = await import("@/lib/kpi/filters");

  const sfx = randomUUID().slice(0, 8);
  const WINDOW = 7;
  const ids: Record<string, string> = {};
  const userIds: string[] = [];
  const agentName = `Revert Agent ${sfx}`;
  const alpha = `Alpha ${sfx}`;
  const bravo = `Bravo ${sfx}`;
  let transferId = "";
  let auditSeq = 0;

  async function roleId(slug: string) {
    const role = await prisma.role.findUnique({ where: { slug }, select: { id: true } });
    if (!role) throw new Error(`Role ${slug} missing — run prisma/seed-rbac.ts on the test DB.`);
    return role.id;
  }

  async function makeUser(key: string, slug: string, extra: { teamName?: string; createdById?: string; name?: string } = {}) {
    const user = await prisma.user.create({
      data: {
        name: extra.name ?? `${key} ${sfx}`,
        email: `${key.toLowerCase()}.${sfx}@revert.test`,
        password: "not-a-real-hash",
        roleId: await roleId(slug),
        teamName: extra.teamName ?? null,
        createdById: extra.createdById ?? null,
      },
    });
    ids[key] = user.id;
    userIds.push(user.id);
    return user.id;
  }

  async function makeAudit(submittedById: string, ownership: {
    agentUserId: string | null;
    ownerSupervisorId: string | null;
    teamMembershipId: string | null;
  }) {
    auditSeq += 1;
    const audit = await prisma.auditSubmission.create({
      data: {
        auditCode: `RV-${sfx}-${auditSeq}`,
        submittedById,
        agent: agentName,
        type: "Call",
        businessType: "B2C",
        callDate: "2026-10-20",
        auditDate: "2026-10-20",
        lob: "Test",
        qualityPct: 90,
        finalPct: 90,
        grade: "A",
        totalScored: 9,
        totalMax: 10,
        scores: {},
        catScores: {},
        rows: [],
        record: {},
        ...ownership,
      },
    });
    return audit.id;
  }

  const actor = (key: string, roleSlug: string) => ({ id: ids[key], roleSlug });

  beforeAll(async () => {
    await makeUser("Admin", "superadmin");
    await makeUser("QmA", "quality-manager");
    await makeUser("QmB", "quality-manager");
    await makeUser("SupA", "supervisor", { teamName: alpha, createdById: ids.QmA });
    await makeUser("SupB", "supervisor", { teamName: bravo, createdById: ids.QmB });
    await makeUser("QaA", "quality-analyst", { createdById: ids.QmA });
    await makeUser("QaB", "quality-analyst", { createdById: ids.QmB });
    await makeUser("Agent", "agent", { teamName: alpha, createdById: ids.SupA, name: agentName });

    await prisma.agentAssignment.create({
      data: { agentId: ids.Agent, assignedToId: ids.QaA, assignedById: ids.QmA },
    });
    const membership = await prisma.agentTeamMembership.create({
      data: { agentUserId: ids.Agent, supervisorId: ids.SupA, teamNameSnapshot: alpha, qaUserId: ids.QaA },
    });
    const owned = { agentUserId: ids.Agent, ownerSupervisorId: ids.SupA, teamMembershipId: membership.id };
    ids.A1 = await makeAudit(ids.QaA, owned);
    ids.A2 = await makeAudit(ids.QaA, owned);
    // Legacy row (pre-migration): no ownership columns, matched by name.
    ids.A3 = await makeAudit(ids.QaA, { agentUserId: null, ownerSupervisorId: null, teamMembershipId: null });
  });

  afterAll(async () => {
    if (userIds.length === 0) return;
    await prisma.auditSubmission.deleteMany({ where: { submittedById: { in: userIds } } });
    await prisma.agentTeamMembership.deleteMany({ where: { agentUserId: { in: userIds } } });
    await prisma.agentTransfer.deleteMany({ where: { agentUserId: { in: userIds }, kind: "REVERT" } });
    await prisma.agentTransfer.deleteMany({ where: { agentUserId: { in: userIds } } });
    await prisma.agentAssignment.deleteMany({ where: { agentId: { in: userIds } } });
    await prisma.securityAuditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { createdById: null } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("transfers Alpha -> Bravo and tags Alpha's audits as Alpha history", async () => {
    const transfer = await prisma.agentTransfer.create({
      data: {
        agentUserId: ids.Agent,
        agentNameSnapshot: agentName,
        agentEmailSnapshot: `agent.${sfx}@revert.test`,
        fromSupervisorId: ids.SupA,
        toSupervisorId: ids.SupB,
        transferredById: ids.QmA,
        status: "PENDING",
      },
    });
    transferId = transfer.id;

    const result = await prisma.$transaction((tx) =>
      engine.executeAgentTransfer(tx, {
        transferId,
        agentUserId: ids.Agent,
        agentDisplayName: agentName,
        fromSupervisorId: ids.SupA,
        toSupervisorId: ids.SupB,
        actorUserId: ids.QmA,
      })
    );
    expect(result.taggedCount).toBe(3);
    expect(result.fromQaUserId).toBe(ids.QaA);

    const agent = await prisma.user.findUniqueOrThrow({ where: { id: ids.Agent } });
    expect(agent.createdById).toBe(ids.SupB);
    expect(agent.teamName).toBe(bravo);
    expect(await prisma.agentAssignment.findUnique({ where: { agentId: ids.Agent } })).toBeNull();

    const alphaAudits = await prisma.auditSubmission.findMany({ where: { id: { in: [ids.A1, ids.A2, ids.A3] } } });
    for (const audit of alphaAudits) {
      expect(audit.isHistory).toBe(true);
      expect(audit.historyOwnerId).toBe(ids.SupA);
      expect(audit.historyTransferId).toBe(transferId);
      expect(audit.teamNameSnapshot).toBe(alpha);
    }
    expect(await assertAuditNotHistory(ids.A1)).toBe("History audits cannot be edited.");

    const t = await prisma.agentTransfer.findUniqueOrThrow({ where: { id: transferId } });
    expect(t.status).toBe("APPROVED");
    expect(t.agentTeamNameBefore).toBe(alpha);
  });

  it("lets Bravo audit the agent with Bravo ownership", async () => {
    await prisma.agentAssignment.create({
      data: { agentId: ids.Agent, assignedToId: ids.QaB, assignedById: ids.QmB },
    });
    const ownership = await resolveAuditOwnership(prisma, agentName);
    expect(ownership.agentUserId).toBe(ids.Agent);
    expect(ownership.ownerSupervisorId).toBe(ids.SupB);
    expect(ownership.teamMembershipId).not.toBeNull();
    ids.B1 = await makeAudit(ids.QaB, ownership);
    // Legacy-shaped Bravo audit (no ownership) created after the transfer.
    ids.B2 = await makeAudit(ids.QaB, { agentUserId: null, ownerSupervisorId: null, teamMembershipId: null });
    expect(await assertAuditNotHistory(ids.B1)).toBeNull();
  });

  it("previews and gates the revert", async () => {
    const preview = await engine.previewAgentTransferRevert(prisma, {
      transferId,
      actor: actor("QmA", "quality-manager"),
      windowDays: WINDOW,
    });
    expect(preview).not.toBeNull();
    expect(preview!.eligible).toBe(true);
    expect(preview!.restoreAuditCount).toBe(3);
    expect(preview!.holdAuditCount).toBe(2);
    expect(preview!.fromTeamName).toBe(alpha);
    expect(preview!.toTeamName).toBe(bravo);

    const asBravoQm = await engine.previewAgentTransferRevert(prisma, {
      transferId,
      actor: actor("QmB", "quality-manager"),
      windowDays: WINDOW,
    });
    expect(asBravoQm!.blockedCode).toBe("FORBIDDEN");

    const asAdmin = await engine.previewAgentTransferRevert(prisma, {
      transferId,
      actor: actor("Admin", "superadmin"),
      windowDays: WINDOW,
    });
    expect(asAdmin!.eligible).toBe(true);

    const late = await engine.previewAgentTransferRevert(prisma, {
      transferId,
      actor: actor("QmA", "quality-manager"),
      windowDays: WINDOW,
      now: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    });
    expect(late!.blockedCode).toBe("WINDOW_EXPIRED");

    await expect(
      prisma.$transaction((tx) =>
        engine.revertAgentTransferInTx(tx, {
          transferId,
          actor: actor("QmA", "quality-manager"),
          reason: "stale version check",
          windowDays: WINDOW,
          idempotencyKey: `stale-${sfx}`,
          expectedVersion: preview!.version + 5,
        })
      )
    ).rejects.toMatchObject({ code: "STALE_VERSION" });

    await expect(
      prisma.$transaction((tx) =>
        engine.revertAgentTransferInTx(tx, {
          transferId,
          actor: actor("QmB", "quality-manager"),
          reason: "not my team",
          windowDays: WINDOW,
          idempotencyKey: `forbidden-${sfx}`,
        })
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reverts: agent back in Alpha, Alpha audits restored, Bravo audits held, QA restored", async () => {
    const key = `revert-${sfx}`;
    const result = await prisma.$transaction(
      (tx) =>
        engine.revertAgentTransferInTx(tx, {
          transferId,
          actor: actor("QmA", "quality-manager"),
          reason: "Transferred by mistake",
          windowDays: WINDOW,
          idempotencyKey: key,
          expectedVersion: 0,
        }),
      { timeout: 30_000 }
    );
    expect(result.alreadyApplied).toBe(false);
    expect(result.restoredAuditCount).toBe(3);
    expect(result.heldAuditCount).toBe(2);
    expect(result.restoredQaUserId).toBe(ids.QaA);
    expect(result.receivingQaUserId).toBe(ids.QaB);
    expect(result.fromSupervisorQmId).toBe(ids.QmA);

    // Agent is back in Alpha.
    const agent = await prisma.user.findUniqueOrThrow({ where: { id: ids.Agent } });
    expect(agent.createdById).toBe(ids.SupA);
    expect(agent.teamName).toBe(alpha);

    // Original QA restored.
    const assignment = await prisma.agentAssignment.findUniqueOrThrow({ where: { agentId: ids.Agent } });
    expect(assignment.assignedToId).toBe(ids.QaA);
    expect(assignment.assignedById).toBe(ids.QmA);

    // Alpha audits are working + editable again, owned by Alpha.
    for (const id of [ids.A1, ids.A2, ids.A3]) {
      const audit = await prisma.auditSubmission.findUniqueOrThrow({ where: { id } });
      expect(audit.isHistory).toBe(false);
      expect(audit.historyTransferId).toBeNull();
      expect(audit.ownerSupervisorId).toBe(ids.SupA);
      expect(await assertAuditNotHistory(id)).toBeNull();
    }

    // Bravo audits stay with Bravo as history.
    for (const id of [ids.B1, ids.B2]) {
      const audit = await prisma.auditSubmission.findUniqueOrThrow({ where: { id } });
      expect(audit.isHistory).toBe(true);
      expect(audit.historyOwnerId).toBe(ids.SupB);
      expect(audit.ownerSupervisorId).toBe(ids.SupB);
      expect(audit.historyTransferId).toBe(result.revertTransferId);
      expect(audit.teamNameSnapshot).toBe(bravo);
      expect(await assertAuditNotHistory(id)).toBe("History audits cannot be edited.");
    }

    // Ledger.
    const original = await prisma.agentTransfer.findUniqueOrThrow({ where: { id: transferId } });
    expect(original.status).toBe("REVERTED");
    expect(original.revertedById).toBe(ids.QmA);
    expect(original.version).toBe(1);
    const revertRow = await prisma.agentTransfer.findUniqueOrThrow({ where: { id: result.revertTransferId } });
    expect(revertRow.kind).toBe("REVERT");
    expect(revertRow.revertOfTransferId).toBe(transferId);
    expect(revertRow.fromSupervisorId).toBe(ids.SupB);
    expect(revertRow.toSupervisorId).toBe(ids.SupA);
    expect(revertRow.auditCountAtTransfer).toBe(2);

    // Membership periods: Alpha (closed) -> Bravo (closed) -> Alpha (open).
    const memberships = await prisma.agentTeamMembership.findMany({
      where: { agentUserId: ids.Agent },
      orderBy: { startedAt: "asc" },
    });
    expect(memberships.map((m) => m.supervisorId)).toEqual([ids.SupA, ids.SupB, ids.SupA]);
    expect(memberships.filter((m) => m.endedAt === null)).toHaveLength(1);
    const open = memberships[2];
    expect(open.qaUserId).toBe(ids.QaA);
    const restored = await prisma.auditSubmission.findMany({ where: { id: { in: [ids.A1, ids.A2, ids.A3] } } });
    expect(restored.every((a) => a.teamMembershipId === open.id)).toBe(true);

    // Security log.
    const logs = await prisma.securityAuditLog.findMany({
      where: { targetUserId: ids.Agent },
      select: { action: true },
    });
    expect(logs.map((l) => l.action).sort()).toEqual(["AGENT_TRANSFERRED", "AGENT_TRANSFER_REVERTED"]);

    // KPIs: all of the agent's audits still count (working + history).
    const rows = await prisma.auditSubmission.findMany({ where: { agent: agentName } });
    const kpi = filterKpiRecords(
      rows.map((r) => ({
        id: r.id,
        agent: r.agent,
        supervisor: r.supervisor,
        auditor: r.auditor,
        type: r.type,
        auditType: r.auditType,
        callDate: r.callDate,
        auditDate: r.auditDate,
        qualityPct: r.qualityPct,
        finalPct: r.finalPct,
        hasFatal: r.hasFatal,
        feedbackStatus: r.feedbackStatus,
        isHistory: r.isHistory,
      })),
      { ...DEFAULT_KPI_FILTERS, time: "all", qm: ids.QmA },
      [agentName]
    );
    expect(kpi).toHaveLength(5);
    expect(kpi.filter((r) => !r.isHistory).map((r) => r.id).sort()).toEqual([ids.A1, ids.A2, ids.A3].sort());

    // Idempotent replay with the same key.
    const replay = await prisma.$transaction((tx) =>
      engine.revertAgentTransferInTx(tx, {
        transferId,
        actor: actor("QmA", "quality-manager"),
        reason: "Transferred by mistake",
        windowDays: WINDOW,
        idempotencyKey: key,
      })
    );
    expect(replay.alreadyApplied).toBe(true);
    expect(replay.revertTransferId).toBe(result.revertTransferId);

    // A fresh request cannot revert twice.
    await expect(
      prisma.$transaction((tx) =>
        engine.revertAgentTransferInTx(tx, {
          transferId,
          actor: actor("Admin", "superadmin"),
          reason: "second attempt",
          windowDays: WINDOW,
          idempotencyKey: `again-${sfx}`,
        })
      )
    ).rejects.toMatchObject({ code: "ALREADY_REVERTED" });

    // The revert ledger row itself is not revertible.
    const revertPreview = await engine.previewAgentTransferRevert(prisma, {
      transferId: result.revertTransferId,
      actor: actor("Admin", "superadmin"),
      windowDays: WINDOW,
    });
    expect(revertPreview!.blockedCode).toBe("NOT_REVERTIBLE");
  });
});
