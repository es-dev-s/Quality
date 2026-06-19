import { auth } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import {
  registerSSESubscriber,
  sendConnected,
  sendHeartbeat,
  unregisterSSESubscriber,
} from "@/lib/sse-broadcast";

export const dynamic = "force-dynamic";

function tagsForRole(userId: string, roleSlug: string): string[] {
  const tags = new Set<string>([
    CACHE_TAGS.userAudits(userId),
    CACHE_TAGS.userDashboard(userId),
    CACHE_TAGS.userAgents(userId),
  ]);

  if (
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERADMIN ||
    roleSlug === SYSTEM_ROLE_SLUGS.ADMIN ||
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
  ) {
    tags.add(CACHE_TAGS.AUDIT_SUBMISSIONS);
    tags.add(CACHE_TAGS.AGENTS);
    tags.add(CACHE_TAGS.USERS);
  }

  if (
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERVISOR ||
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
  ) {
    tags.add(CACHE_TAGS.AGENT_ASSIGNMENTS);
  }

  return [...tags];
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const roleSlug = session.user.role?.slug ?? SYSTEM_ROLE_SLUGS.AGENT;
  const userTags = tagsForRole(userId, roleSlug);

  const stream = new ReadableStream({
    start(controller) {
      registerSSESubscriber(userId, userTags, controller);
      sendConnected(userId, controller);

      const heartbeat = setInterval(() => {
        sendHeartbeat(controller);
      }, 30_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unregisterSSESubscriber(userId, userTags, controller);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
