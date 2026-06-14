-- AlterTable
ALTER TABLE "AuditSubmission" ADD COLUMN IF NOT EXISTS "feedbackSecurity" TEXT NOT NULL DEFAULT 'NA';
ALTER TABLE "AuditSubmission" ADD COLUMN IF NOT EXISTS "feedbackDate" TEXT;
