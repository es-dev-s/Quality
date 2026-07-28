-- AlterTable
ALTER TABLE "AuditSubmission" ADD COLUMN IF NOT EXISTS "audit_type" TEXT NOT NULL DEFAULT '';

-- Optional lookup aid for filters/reports
CREATE INDEX IF NOT EXISTS "AuditSubmission_audit_type_idx" ON "AuditSubmission"("audit_type");
