-- CreateEnum
CREATE TYPE "AgentTransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "agent_transfers" ADD COLUMN     "assigned_reviewer_id" TEXT,
ADD COLUMN     "status" "AgentTransferStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reviewed_by_id" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "review_note" TEXT;

-- Backfill existing completed transfers
UPDATE "agent_transfers"
SET
  "status" = 'APPROVED',
  "requested_at" = "transferred_at"
WHERE "transferred_at" IS NOT NULL;

-- Allow transferred_at to be null for pending rows going forward
ALTER TABLE "agent_transfers" ALTER COLUMN "transferred_at" DROP NOT NULL;
ALTER TABLE "agent_transfers" ALTER COLUMN "transferred_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "agent_transfers_status_idx" ON "agent_transfers"("status");

-- CreateIndex
CREATE INDEX "agent_transfers_assigned_reviewer_id_idx" ON "agent_transfers"("assigned_reviewer_id");

-- CreateIndex
CREATE INDEX "agent_transfers_requested_at_idx" ON "agent_transfers"("requested_at");

-- AddForeignKey
ALTER TABLE "agent_transfers" ADD CONSTRAINT "agent_transfers_assigned_reviewer_id_fkey" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_transfers" ADD CONSTRAINT "agent_transfers_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
