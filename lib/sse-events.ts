import type { NotificationItem } from "@/lib/notifications/types";

export type SSEEvent =
  | { type: "connected"; userId: string }
  | { type: "audit:created"; auditId: string; submittedById: string }
  | { type: "audit:updated"; auditId: string; changes?: Record<string, unknown> }
  | { type: "audit:deleted"; auditId: string }
  | { type: "user:activated"; userId: string }
  | { type: "user:deactivated"; userId: string }
  | { type: "agent:assigned"; agentId: string; assignedToId: string }
  | { type: "agent:unassigned"; agentId: string; assignedToId: string }
  | { type: "agent:approved"; agentId: string }
  | {
      type: "agent:transferred";
      agentId: string;
      transferId: string;
      fromSupervisorId: string;
      toSupervisorId: string;
    }
  | {
      type: "agent:transfer-reverted";
      agentId: string;
      transferId: string;
      revertTransferId: string;
      fromSupervisorId: string;
      toSupervisorId: string;
    }
  | { type: "notification:new"; notification: NotificationItem }
  | { type: "invalidate"; tags: string[] };

export function isNotificationSSEEvent(
  event: SSEEvent
): event is Extract<SSEEvent, { type: "notification:new" }> {
  return event.type === "notification:new";
}

/** Transfers move audits between working/history, so they refresh audit views. */
export function isAgentTransferSSEEvent(event: SSEEvent): boolean {
  return (
    event.type === "agent:transferred" ||
    event.type === "agent:transfer-reverted"
  );
}

export function isAuditSSEEvent(event: SSEEvent): boolean {
  return (
    isAgentTransferSSEEvent(event) ||
    event.type === "audit:created" ||
    event.type === "audit:updated" ||
    event.type === "audit:deleted" ||
    event.type === "invalidate"
  );
}
