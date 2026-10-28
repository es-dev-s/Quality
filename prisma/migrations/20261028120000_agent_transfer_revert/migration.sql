-- Agent transfer revert: transfer kind/REVERTED status, revert linkage,
-- idempotency + optimistic version, team membership periods, and stable
-- audit ownership columns (agent_user_id / owner_supervisor_id).
-- NOTE: intentionally excludes the unrelated pre-existing index-name drift
-- (AuditSubmission_templateId_* -> AuditSubmission_template_id_*).

-- CreateEnum
CREATE TYPE "AgentTransferKind" AS ENUM ('TRANSFER', 'REVERT');

-- AlterEnum
ALTER TYPE "AgentTransferStatus" ADD VALUE 'REVERTED';

-- AlterTable
ALTER TABLE "AuditSubmission" ADD COLUMN     "agent_user_id" TEXT,
ADD COLUMN     "owner_supervisor_id" TEXT,
ADD COLUMN     "team_membership_id" TEXT;

-- AlterTable
ALTER TABLE "agent_transfers" ADD COLUMN     "agent_team_name_before" TEXT,
ADD COLUMN     "from_qa_assigned_by_id" TEXT,
ADD COLUMN     "from_team_name_snapshot" TEXT,
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "kind" "AgentTransferKind" NOT NULL DEFAULT 'TRANSFER',
ADD COLUMN     "revert_of_transfer_id" TEXT,
ADD COLUMN     "revert_reason" TEXT,
ADD COLUMN     "reverted_at" TIMESTAMP(3),
ADD COLUMN     "reverted_by_id" TEXT,
ADD COLUMN     "to_team_name_snapshot" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "agent_team_memberships" (
    "id" TEXT NOT NULL,
    "agent_user_id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "team_name_snapshot" TEXT,
    "qa_user_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "started_by_transfer_id" TEXT,
    "ended_by_transfer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_team_memberships_agent_user_id_started_at_idx" ON "agent_team_memberships"("agent_user_id", "started_at");

-- CreateIndex
CREATE INDEX "agent_team_memberships_supervisor_id_idx" ON "agent_team_memberships"("supervisor_id");

-- CreateIndex
CREATE INDEX "AuditSubmission_agent_user_id_is_history_idx" ON "AuditSubmission"("agent_user_id", "is_history");

-- CreateIndex
CREATE INDEX "AuditSubmission_owner_supervisor_id_idx" ON "AuditSubmission"("owner_supervisor_id");

-- CreateIndex
CREATE INDEX "AuditSubmission_team_membership_id_idx" ON "AuditSubmission"("team_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_transfers_revert_of_transfer_id_key" ON "agent_transfers"("revert_of_transfer_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_transfers_idempotency_key_key" ON "agent_transfers"("idempotency_key");

-- CreateIndex
CREATE INDEX "agent_transfers_agent_user_id_status_idx" ON "agent_transfers"("agent_user_id", "status");

-- AddForeignKey
ALTER TABLE "agent_transfers" ADD CONSTRAINT "agent_transfers_reverted_by_id_fkey" FOREIGN KEY ("reverted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_transfers" ADD CONSTRAINT "agent_transfers_revert_of_transfer_id_fkey" FOREIGN KEY ("revert_of_transfer_id") REFERENCES "agent_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_team_memberships" ADD CONSTRAINT "agent_team_memberships_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_team_memberships" ADD CONSTRAINT "agent_team_memberships_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_team_memberships" ADD CONSTRAINT "agent_team_memberships_started_by_transfer_id_fkey" FOREIGN KEY ("started_by_transfer_id") REFERENCES "agent_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_team_memberships" ADD CONSTRAINT "agent_team_memberships_ended_by_transfer_id_fkey" FOREIGN KEY ("ended_by_transfer_id") REFERENCES "agent_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubmission" ADD CONSTRAINT "AuditSubmission_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubmission" ADD CONSTRAINT "AuditSubmission_owner_supervisor_id_fkey" FOREIGN KEY ("owner_supervisor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubmission" ADD CONSTRAINT "AuditSubmission_team_membership_id_fkey" FOREIGN KEY ("team_membership_id") REFERENCES "agent_team_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most one open membership period per agent.
CREATE UNIQUE INDEX "agent_team_memberships_one_open_per_agent" ON "agent_team_memberships"("agent_user_id") WHERE "ended_at" IS NULL;
