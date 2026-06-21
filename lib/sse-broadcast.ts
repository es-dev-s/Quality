import type { SSEEvent } from "@/lib/sse-events";

/**
 * In-memory SSE subscriber registry (single Node instance).
 * TODO: For multi-instance deploys, replace with PostgreSQL LISTEN/NOTIFY
 * or another shared pub/sub so all instances receive mutation events.
 */
type Controller = ReadableStreamDefaultController<Uint8Array>;

const subscribersByUser = new Map<string, Set<Controller>>();
const subscribersByTag = new Map<string, Set<Controller>>();

function encodeEvent(event: SSEEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

function forEachController(
  controllers: Set<Controller> | undefined,
  data: Uint8Array,
  delivered?: Set<Controller>
) {
  if (!controllers) return;
  for (const controller of controllers) {
    if (delivered?.has(controller)) continue;
    delivered?.add(controller);
    try {
      controller.enqueue(data);
    } catch {
      controllers.delete(controller);
    }
  }
}

export function registerSSESubscriber(
  userId: string,
  tags: Iterable<string>,
  controller: Controller
) {
  if (!subscribersByUser.has(userId)) {
    subscribersByUser.set(userId, new Set());
  }
  subscribersByUser.get(userId)!.add(controller);

  for (const tag of tags) {
    if (!subscribersByTag.has(tag)) {
      subscribersByTag.set(tag, new Set());
    }
    subscribersByTag.get(tag)!.add(controller);
  }
}

export function unregisterSSESubscriber(
  userId: string,
  tags: Iterable<string>,
  controller: Controller
) {
  subscribersByUser.get(userId)?.delete(controller);
  for (const tag of tags) {
    subscribersByTag.get(tag)?.delete(controller);
  }
}

export function broadcastToUser(userId: string, event: SSEEvent) {
  forEachController(subscribersByUser.get(userId), encodeEvent(event));
}

export function broadcastToTag(tag: string, event: SSEEvent) {
  forEachController(subscribersByTag.get(tag), encodeEvent(event));
}

/** Delivers once per connection even when a client listens on multiple tags. */
export function broadcastToTags(tags: string[], event: SSEEvent) {
  const data = encodeEvent(event);
  const delivered = new Set<Controller>();
  for (const tag of new Set(tags)) {
    forEachController(subscribersByTag.get(tag), data, delivered);
  }
}

export function sendConnected(userId: string, controller: Controller) {
  try {
    controller.enqueue(
      encodeEvent({ type: "connected", userId })
    );
  } catch {
    // client disconnected
  }
}

export function sendHeartbeat(controller: Controller) {
  try {
    controller.enqueue(new TextEncoder().encode(": ping\n\n"));
  } catch {
    // client disconnected
  }
}
