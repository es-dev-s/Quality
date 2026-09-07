-- AlterTable
ALTER TABLE "agent_transfers" ADD COLUMN "from_qa_user_id" TEXT;

-- CreateIndex
CREATE INDEX "agent_transfers_from_qa_user_id_idx" ON "agent_transfers"("from_qa_user_id");

-- AddForeignKey
ALTER TABLE "agent_transfers" ADD CONSTRAINT "agent_transfers_from_qa_user_id_fkey" FOREIGN KEY ("from_qa_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
