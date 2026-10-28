import { describe, expect, it } from "vitest";
import { createAuditOwnershipResolver } from "@/lib/agent-transfer/ownership";

type AgentRow = { id: string; name: string | null; email: string; createdById: string | null };
type MembershipRow = { id: string; agentUserId: string; supervisorId: string };

function fakeDb(agents: AgentRow[], memberships: MembershipRow[]) {
  return {
    user: { findMany: async () => agents },
    agentTeamMembership: {
      findMany: async () => memberships,
    },
  } as unknown as Parameters<typeof createAuditOwnershipResolver>[0];
}

describe("audit ownership resolver", () => {
  const agents: AgentRow[] = [
    { id: "a1", name: "Asha Rai", email: "asha@example.test", createdById: "supA" },
    { id: "a2", name: "Dup Name", email: "dup1@example.test", createdById: "supA" },
    { id: "a3", name: "dup name", email: "dup2@example.test", createdById: "supB" },
  ];
  const memberships: MembershipRow[] = [
    { id: "m1", agentUserId: "a1", supervisorId: "supA" },
    { id: "m3", agentUserId: "a3", supervisorId: "supX" },
  ];

  it("resolves a unique name (case/space-insensitive) to agent, owner and membership", async () => {
    const resolve = await createAuditOwnershipResolver(fakeDb(agents, memberships));
    expect(resolve("  asha   RAI ")).toEqual({
      agentUserId: "a1",
      ownerSupervisorId: "supA",
      teamMembershipId: "m1",
    });
  });

  it("resolves by email too", async () => {
    const resolve = await createAuditOwnershipResolver(fakeDb(agents, memberships));
    expect(resolve("ASHA@example.test").agentUserId).toBe("a1");
  });

  it("never guesses for ambiguous or unknown names", async () => {
    const resolve = await createAuditOwnershipResolver(fakeDb(agents, memberships));
    const empty = { agentUserId: null, ownerSupervisorId: null, teamMembershipId: null };
    expect(resolve("Dup Name")).toEqual(empty);
    expect(resolve("Nobody")).toEqual(empty);
    expect(resolve("")).toEqual(empty);
    expect(resolve(null)).toEqual(empty);
  });

  it("drops a membership that does not match the current supervisor", async () => {
    const resolve = await createAuditOwnershipResolver(
      fakeDb([{ id: "a3", name: "Solo", email: "solo@example.test", createdById: "supB" }], memberships)
    );
    expect(resolve("Solo")).toEqual({
      agentUserId: "a3",
      ownerSupervisorId: "supB",
      teamMembershipId: null,
    });
  });
});
