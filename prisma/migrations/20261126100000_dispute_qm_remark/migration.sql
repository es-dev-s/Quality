-- QA-35: Quality Manager remark following the supervisor dispute remark.
ALTER TABLE "AuditSubmission" ADD COLUMN IF NOT EXISTS "dispute_qm_remark" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AuditSubmission" ADD COLUMN IF NOT EXISTS "dispute_qm_remark_at" TIMESTAMP(3);
ALTER TABLE "AuditSubmission" ADD COLUMN IF NOT EXISTS "dispute_qm_remark_by_id" TEXT;
