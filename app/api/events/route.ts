import { auth } from "@/lib/auth";
import { sseTagsForUser } from "@/lib/sse-tags";
import {
  registerSSESubscriber,
  sendConnected,
  sendHeartbeat,
  unregisterSSESubscriber,
} from "@/lib/sse-broadcast";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const userTags = sseTagsForUser(userId, session.user.role);

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
