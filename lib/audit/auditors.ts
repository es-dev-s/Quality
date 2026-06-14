import type { InteractionConfig } from "@/lib/audit/types";
import { fetchActiveAuditorUserNames } from "@/lib/audit/role-users";

type UserLike = { name: string | null; email: string };

export function mergeAuditorOptions(
  config: Pick<InteractionConfig, "auditors">,
  users: UserLike[] = []
): string[] {
  const merged = new Set<string>([
    ...config.auditors,
    ...users
      .map((user) => user.name?.trim() || user.email)
      .filter(Boolean),
  ]);

  return Array.from(merged).sort((a, b) => a.localeCompare(b));
}

export async function fetchAuditorDropdownNames(): Promise<string[]> {
  return fetchActiveAuditorUserNames();
}

export function isAllowedAuditor(
  auditor: string,
  config: Pick<InteractionConfig, "auditors">,
  users: UserLike[] = []
): boolean {
  if (!auditor.trim()) return true;
  const key = auditor.toLowerCase();
  return mergeAuditorOptions(config, users).some(
    (option) => option.toLowerCase() === key
  );
}
