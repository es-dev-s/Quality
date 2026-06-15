ALTER TABLE "AuditSubmission" ADD COLUMN IF NOT EXISTS "feedback_status_at" TEXT;
ALTER TABLE "AuditSubmission" ADD COLUMN IF NOT EXISTS "supervisor_remarks" TEXT NOT NULL DEFAULT '';
