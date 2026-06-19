import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache";
import { broadcastToTags } from "@/lib/sse-broadcast";
import type { SSEEvent } from "@/lib/sse-events";

export function invalidateCacheTags(tags: string[], event?: SSEEvent) {
  const unique = [...new Set(tags)];
  for (const tag of unique) {
    revalidateTag(tag, "max");
  }
  if (event) {
    broadcastToTags(unique, event);
  }
}

export function invalidateAuditCaches(
  userId: string,
  event?: SSEEvent
) {
  invalidateCacheTags(
    [
      CACHE_TAGS.AUDIT_SUBMISSIONS,
      CACHE_TAGS.userAudits(userId),
      CACHE_TAGS.userDashboard(userId),
    ],
    event
  );
}

export function invalidateUserCaches(userId: string, event?: SSEEvent) {
  invalidateCacheTags(
    [CACHE_TAGS.USERS, CACHE_TAGS.userAgents(userId)],
    event
  );
}

export function invalidateAgentAssignmentCaches(
  actorId: string,
  assignedToId: string,
  event?: SSEEvent
) {
  invalidateCacheTags(
    [
      CACHE_TAGS.AGENT_ASSIGNMENTS,
      CACHE_TAGS.AGENTS,
      CACHE_TAGS.userAgents(actorId),
      CACHE_TAGS.userAgents(assignedToId),
    ],
    event
  );
}

export function invalidateAgentCaches(event?: SSEEvent) {
  invalidateCacheTags([CACHE_TAGS.AGENTS, CACHE_TAGS.USERS], event);
}

export function invalidateTemplateCaches() {
  invalidateCacheTags([CACHE_TAGS.AUDIT_TEMPLATES]);
}

export function invalidateRoleCaches() {
  invalidateCacheTags([CACHE_TAGS.ROLES, CACHE_TAGS.USERS]);
}

export function invalidateInteractionConfigCaches() {
  invalidateCacheTags([CACHE_TAGS.INTERACTION_CONFIGS]);
  revalidateTag("interaction-config", "max");
}
