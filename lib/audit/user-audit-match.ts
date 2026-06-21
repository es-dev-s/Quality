import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { normalizeAgentName } from "@/lib/audit/agent-name";
import { resolveRoleUserName } from "@/lib/audit/role-users";

type UserNameFields = {
  name: string | null;
  email: string;
};

/** All display strings that may appear on audit rows for a user. */
export async function fetchUserAuditMatchNames(
  user: UserNameFields
): Promise<string[]> {
  const names = new Set<string>();

  const display = resolveRoleUserName(user);
  if (display) names.add(display);

  const trimmedName = user.name?.trim();
  if (trimmedName) names.add(trimmedName);

  const email = user.email.trim();
  if (email) {
    names.add(email);
    names.add(email.toLowerCase());
  }

  return [...names];
}

/** Match names for agent-role users, including linked Agent roster entries. */
export const fetchAgentUserAuditMatchNames = cache(
  async (userId: string): Promise<string[]> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!user) return [];

    const names = new Set(await fetchUserAuditMatchNames(user));

    const trimmedName = user.name?.trim();
    if (trimmedName) {
      const { nameKey } = normalizeAgentName(trimmedName);
      const rosterAgents = await prisma.agent.findMany({
        where: { nameKey },
        select: { name: true },
      });
      for (const row of rosterAgents) {
        if (row.name) names.add(row.name);
      }
    }

    return [...names];
  }
);

export async function fetchUserAuditMatchNamesById(
  userId: string
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) return [];
  return fetchUserAuditMatchNames(user);
}
