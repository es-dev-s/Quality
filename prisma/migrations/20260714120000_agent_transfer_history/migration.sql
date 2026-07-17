-- CreateTable
CREATE TABLE "agent_transfers" (
    "id" TEXT NOT NULL,
    "agent_user_id" TEXT NOT NULL,
    "agent_name_snapshot" TEXT NOT NULL,
    "agent_email_snapshot" TEXT NOT NULL,
    "from_supervisor_id" TEXT NOT NULL,
    "to_supervisor_id" TEXT NOT NULL,
    "transferred_by_id" TEXT NOT NULL,
    "note" TEXT,
    "audit_count_at_transfer" INTEGER NOT NULL DEFAULT 0,
    "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_transfers_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AuditSubmission" ADD COLUMN     "is_history" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "history_owner_id" TEXT,
ADD COLUMN     "history_transfer_id" TEXT;

-- CreateIndex
CREATE INDEX "agent_transfers_from_supervisor_id_idx" ON "agent_transfers"("from_supervisor_id");

-- CreateIndex
CREATE INDEX "agent_transfers_to_supervisor_id_idx" ON "agent_transfers"("to_supervisor_id");

-- CreateIndex
CREATE INDEX "agent_transfers_agent_user_id_idx" ON "agent_transfers"("agent_user_id");

-- CreateIndex
CREATE INDEX "agent_transfers_transferred_at_idx" ON "agent_transfers"("transferred_at");

-- CreateIndex
CREATE INDEX "AuditSubmission_is_history_idx" ON "AuditSubmission"("is_history");

-- CreateIndex
CREATE INDEX "AuditSubmission_history_owner_id_idx" ON "AuditSubmission"("history_owner_id");

-- CreateIndex
CREATE INDEX "AuditSubmission_history_transfer_id_idx" ON "AuditSubmission"("history_transfer_id");

-- AddForeignKey
ALTER TABLE "AuditSubmission" ADD CONSTRAINT "AuditSubmission_history_owner_id_fkey" FOREIGN KEY ("history_owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubmission" ADD CONSTRAINT "AuditSubmission_history_transfer_id_fkey" FOREIGN KEY ("history_transfer_id") REFERENCES "agent_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_transfers" ADD CONSTRAINT "agent_transfers_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_transfers" ADD CONSTRAINT "agent_transfers_from_supervisor_id_fkey" FOREIGN KEY ("from_supervisor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_transfers" ADD CONSTRAINT "agent_transfers_to_supervisor_id_fkey" FOREIGN KEY ("to_supervisor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_transfers" ADD CONSTRAINT "agent_transfers_transferred_by_id_fkey" FOREIGN KEY ("transferred_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
