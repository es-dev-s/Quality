import { NOTIFICATION_TYPES } from "@/lib/notifications/constants";
import { persistUserNotification } from "@/lib/notifications/persist";
import { broadcastToUser } from "@/lib/sse-broadcast";
import type { SSEEvent } from "@/lib/sse-events";

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

type Party = {
  agentUserId: string;
  agentName: string;
  fromSupervisorId: string;
  toSupervisorId: string;
  qaUserIds: Array<string | null | undefined>;
  qmUserIds: Array<string | null | undefined>;
  actorUserId: string;
};

async function safeNotify(
  input: Parameters<typeof persistUserNotification>[0]
): Promise<void> {
  try {
    await persistUserNotification(input);
  } catch (error) {
    console.error("Agent transfer notification failed:", error);
  }
}

function broadcastAll(userIds: string[], event: SSEEvent) {
  for (const userId of userIds) {
    try {
      broadcastToUser(userId, event);
    } catch (error) {
      console.error("Agent transfer SSE broadcast failed:", error);
    }
  }
}

/** Fire-and-forget side effects after a committed transfer. Never throws. */
export async function emitAgentTransferredEvents(
  party: Party & {
    transferId: string;
    fromLabel: string;
    toLabel: string;
  }
) {
  const staff = uniqueIds([
    party.fromSupervisorId,
    party.toSupervisorId,
    ...party.qaUserIds,
    ...party.qmUserIds,
    party.actorUserId,
  ]);
  broadcastAll([...staff, party.agentUserId], {
    type: "agent:transferred",
    agentId: party.agentUserId,
    transferId: party.transferId,
    fromSupervisorId: party.fromSupervisorId,
    toSupervisorId: party.toSupervisorId,
  });

  const body = `${party.agentName} moved from ${party.fromLabel} to ${party.toLabel}.`;
  await Promise.all([
    ...staff
      .filter((id) => id !== party.actorUserId)
      .map((userId) =>
        safeNotify({
          userId,
          type: NOTIFICATION_TYPES.AGENT_TRANSFERRED,
          title: "Agent transferred",
          body,
          dedupeKey: `transfer:${party.transferId}`,
          meta: { transferId: party.transferId, agentUserId: party.agentUserId },
        })
      ),
    safeNotify({
      userId: party.agentUserId,
      type: NOTIFICATION_TYPES.AGENT_TEAM_CHANGED,
      title: "Your team changed",
      body: `You are now on ${party.toLabel}.`,
      dedupeKey: `transfer:${party.transferId}`,
      meta: { transferId: party.transferId },
    }),
  ]);
}

export async function emitAgentTransferRevertedEvents(
  party: Party & {
    transferId: string;
    revertTransferId: string;
    fromLabel: string;
    toLabel: string;
    reason: string;
  }
) {
  const staff = uniqueIds([
    party.fromSupervisorId,
    party.toSupervisorId,
    ...party.qaUserIds,
    ...party.qmUserIds,
    party.actorUserId,
  ]);
  broadcastAll([...staff, party.agentUserId], {
    type: "agent:transfer-reverted",
    agentId: party.agentUserId,
    transferId: party.transferId,
    revertTransferId: party.revertTransferId,
    fromSupervisorId: party.fromSupervisorId,
    toSupervisorId: party.toSupervisorId,
  });

  const body = `${party.agentName} was returned from ${party.toLabel} to ${party.fromLabel}. Reason: ${party.reason}`;
  await Promise.all([
    ...staff
      .filter((id) => id !== party.actorUserId)
      .map((userId) =>
        safeNotify({
          userId,
          type: NOTIFICATION_TYPES.AGENT_TRANSFER_REVERTED,
          title: "Agent transfer reverted",
          body,
          dedupeKey: `revert:${party.revertTransferId}`,
          meta: {
            transferId: party.transferId,
            revertTransferId: party.revertTransferId,
            agentUserId: party.agentUserId,
          },
        })
      ),
    safeNotify({
      userId: party.agentUserId,
      type: NOTIFICATION_TYPES.AGENT_TEAM_CHANGED,
      title: "Your team changed",
      body: `You are back on ${party.fromLabel}.`,
      dedupeKey: `revert:${party.revertTransferId}`,
      meta: { transferId: party.transferId, revertTransferId: party.revertTransferId },
    }),
  ]);
}
