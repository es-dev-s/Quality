import { CACHE_TAGS } from "@/lib/cache";
import { PERMISSIONS } from "@/lib/permissions";
import { hasScope, type SessionRole } from "@/lib/rbac";

/**
 * Cache/SSE tags a connected client should listen on, derived from RBAC scopes
 * (not hard-coded role slugs) so custom roles stay in sync.
 */
export function sseTagsForUser(userId: string, role: SessionRole): string[] {
  const tags = new Set<string>([
    CACHE_TAGS.userAudits(userId),
    CACHE_TAGS.userDashboard(userId),
    CACHE_TAGS.userAgents(userId),
  ]);

  if (hasScope(role, PERMISSIONS.AUDIT_LOGS_READ)) {
    tags.add(CACHE_TAGS.AUDIT_SUBMISSIONS);
  }

  if (
    hasScope(role, PERMISSIONS.ADMIN_USERS) ||
    hasScope(role, PERMISSIONS.USERS_READ_MANAGED)
  ) {
    tags.add(CACHE_TAGS.USERS);
  }

  if (
    hasScope(role, PERMISSIONS.USERS_READ_MANAGED) ||
    hasScope(role, PERMISSIONS.AGENT_ASSIGN)
  ) {
    tags.add(CACHE_TAGS.AGENT_ASSIGNMENTS);
    tags.add(CACHE_TAGS.AGENTS);
  }

  return [...tags];
}
