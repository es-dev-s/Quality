-- AlterTable
ALTER TABLE "AuditSubmission" ADD COLUMN IF NOT EXISTS "agentFeedback" TEXT NOT NULL DEFAULT '';
