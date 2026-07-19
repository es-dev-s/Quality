-- One pending transfer per agent (prevents duplicate concurrent requests).
CREATE UNIQUE INDEX "agent_transfers_one_pending_per_agent_idx"
ON "agent_transfers"("agent_user_id")
WHERE "status" = 'PENDING';
