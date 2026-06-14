import { AUDITORS } from "@/lib/audit/seed-data";
import type { InteractionConfig } from "@/lib/audit/types";

type UserLike = { name: string | null; email: string };

export function mergeAuditorOptions(
  config: Pick<InteractionConfig, "auditors">,
  users: UserLike[]
): string[] {
  const merged = new Set<string>([
    ...config.auditors,
    ...users.map((user) => user.name || user.email).filter(Boolean),
  ]);

  if (merged.size > 0) {
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }

  return [...AUDITORS];
}

export function isAllowedAuditor(
  auditor: string,
  config: Pick<InteractionConfig, "auditors">,
  users: UserLike[]
): boolean {
  if (!auditor.trim()) return true;
  const key = auditor.toLowerCase();
  return mergeAuditorOptions(config, users).some(
    (option) => option.toLowerCase() === key
  );
}
