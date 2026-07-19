import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

/** Supervisor team-management roles (provision agents, scoped roster). */
export const SUPERVISOR_TIER_ROLE_SLUGS = [
  SYSTEM_ROLE_SLUGS.SUPERVISOR,
  SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR,
] as const;

export type SupervisorTierRoleSlug =
  (typeof SUPERVISOR_TIER_ROLE_SLUGS)[number];

export function isSupervisorTierRole(
  slug: string
): slug is SupervisorTierRoleSlug {
  return (SUPERVISOR_TIER_ROLE_SLUGS as readonly string[]).includes(slug);
}

export const SUPERVISOR_TIER_ROLE_SLUG_FILTER = {
  in: [...SUPERVISOR_TIER_ROLE_SLUGS],
};

export function isSupervisorRoleSlug(slug: string | null | undefined): boolean {
  return (
    slug === SYSTEM_ROLE_SLUGS.SUPERVISOR ||
    slug === SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR
  );
}
