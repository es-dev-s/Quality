/**
 * Backfill audit ownership + agent team memberships for the transfer-revert feature.
 *
 *   npx tsx scripts/backfill-transfer-ownership.ts            # dry run (default)
 *   npx tsx scripts/backfill-transfer-ownership.ts --apply    # write changes
 *   ... --report=path/to/report.csv                           # ambiguity report path
 *
 * - Sets AuditSubmission.agentUserId by matching the audit's agent name to exactly
 *   one agent user (name or email, case/space-insensitive). Ambiguous or unknown
 *   names are NOT guessed; they are written to the CSV report for manual review.
 * - Sets ownerSupervisorId: history rows -> historyOwnerId or the transfer's
 *   fromSupervisorId; working rows -> the agent's current supervisor.
 * - Creates an open AgentTeamMembership for each agent with a supervisor and none
 *   open, and links working audits to it.
 * Safe to re-run: only rows with missing values are touched.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { normalizeAgentName } from "@/lib/audit/agent-name";

const APPLY = process.argv.includes("--apply");
const reportArg = process.argv.find((arg) => arg.startsWith("--report="));
const REPORT_PATH = resolve(
  reportArg
    ? reportArg.slice("--report=".length)
    : `backfill-reports/transfer-ownership-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.csv`
);
const CHUNK = 500;

type AgentRow = {
  id: string;
  name: string | null;
  email: string;
  createdById: string | null;
  teamName: string | null;
};

function keysFor(agent: { name: string | null; email: string }): string[] {
  const keys = new Set<string>();
  if (agent.name?.trim()) keys.add(normalizeAgentName(agent.name).nameKey);
  if (agent.email?.trim()) keys.add(agent.email.trim().toLowerCase());
  return [...keys];
}

function csv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  console.log(`=== Transfer ownership backfill (${APPLY ? "APPLY" : "DRY RUN"}) ===`);

  const agents: AgentRow[] = await prisma.user.findMany({
    where: { role: { slug: SYSTEM_ROLE_SLUGS.AGENT } },
    select: { id: true, name: true, email: true, createdById: true, teamName: true },
  });
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const byKey = new Map<string, AgentRow[]>();
  for (const agent of agents) {
    for (const key of keysFor(agent)) {
      const list = byKey.get(key) ?? [];
      if (!list.some((row) => row.id === agent.id)) list.push(agent);
      byKey.set(key, list);
    }
  }

  // 1) Memberships for agents that have a supervisor but no open membership.
  const open = await prisma.agentTeamMembership.findMany({
    where: { endedAt: null },
    select: { id: true, agentUserId: true, supervisorId: true },
  });
  const openByAgent = new Map(open.map((row) => [row.agentUserId, row]));
  const assignments = await prisma.agentAssignment.findMany({
    select: { agentId: true, assignedToId: true },
  });
  const qaByAgent = new Map(assignments.map((row) => [row.agentId, row.assignedToId]));
  const needMembership = agents.filter(
    (agent) => agent.createdById && !openByAgent.has(agent.id)
  );
  console.log(`Agents: ${agents.length}; needing an open membership: ${needMembership.length}`);
  if (APPLY) {
    for (const agent of needMembership) {
      const created = await prisma.agentTeamMembership.create({
        data: {
          agentUserId: agent.id,
          supervisorId: agent.createdById!,
          teamNameSnapshot: agent.teamName?.trim() || null,
          qaUserId: qaByAgent.get(agent.id) ?? null,
        },
        select: { id: true, agentUserId: true, supervisorId: true },
      });
      openByAgent.set(agent.id, created);
    }
  }

  // 2) Audit ownership.
  const audits = await prisma.auditSubmission.findMany({
    where: { OR: [{ agentUserId: null }, { ownerSupervisorId: null }] },
    select: {
      id: true,
      auditCode: true,
      agent: true,
      isHistory: true,
      agentUserId: true,
      ownerSupervisorId: true,
      teamMembershipId: true,
      historyOwnerId: true,
      historyTransfer: { select: { fromSupervisorId: true } },
    },
  });
  console.log(`Audits missing ownership: ${audits.length}`);

  const report: string[] = [
    "audit_id,audit_code,agent_name,is_history,issue,candidate_agent_user_ids",
  ];
  const updates = new Map<string, { ids: string[]; data: Record<string, string> }>();
  let ambiguous = 0;
  let unmatched = 0;
  let noOwner = 0;

  for (const audit of audits) {
    let agentUserId = audit.agentUserId;
    if (!agentUserId) {
      const candidates = byKey.get(normalizeAgentName(audit.agent ?? "").nameKey) ?? [];
      if (candidates.length === 1) {
        agentUserId = candidates[0].id;
      } else {
        const issue = candidates.length === 0 ? "unmatched" : "ambiguous";
        if (issue === "ambiguous") ambiguous += 1;
        else unmatched += 1;
        report.push(
          [
            audit.id,
            audit.auditCode,
            audit.agent,
            audit.isHistory,
            issue,
            candidates.map((c) => c.id).join(" "),
          ]
            .map(csv)
            .join(",")
        );
      }
    }

    let owner = audit.ownerSupervisorId;
    if (!owner) {
      owner = audit.isHistory
        ? (audit.historyOwnerId ?? audit.historyTransfer?.fromSupervisorId ?? null)
        : agentUserId
          ? (agentById.get(agentUserId)?.createdById ?? null)
          : null;
      if (!owner && agentUserId) noOwner += 1;
    }

    const data: Record<string, string> = {};
    if (agentUserId && !audit.agentUserId) data.agentUserId = agentUserId;
    if (owner && !audit.ownerSupervisorId) data.ownerSupervisorId = owner;
    if (!audit.isHistory && agentUserId && !audit.teamMembershipId) {
      const membership = openByAgent.get(agentUserId);
      if (membership && membership.supervisorId === owner) {
        data.teamMembershipId = membership.id;
      }
    }
    if (Object.keys(data).length === 0) continue;
    const key = JSON.stringify(data);
    const group = updates.get(key) ?? { ids: [], data };
    group.ids.push(audit.id);
    updates.set(key, group);
  }

  const toUpdate = [...updates.values()].reduce((sum, g) => sum + g.ids.length, 0);
  console.log(`Audits to update: ${toUpdate}`);
  console.log(`Ambiguous agent names: ${ambiguous}; unmatched: ${unmatched}; matched without owner: ${noOwner}`);

  if (APPLY) {
    let done = 0;
    for (const group of updates.values()) {
      for (const ids of chunk(group.ids, CHUNK)) {
        const result = await prisma.auditSubmission.updateMany({
          where: { id: { in: ids } },
          data: group.data,
        });
        done += result.count;
      }
    }
    console.log(`Updated audits: ${done}`);
  }

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${report.join("\n")}\n`);
  console.log(`Ambiguity report (${report.length - 1} rows): ${REPORT_PATH}`);
  if (!APPLY) console.log("Dry run only. Re-run with --apply to write changes.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
