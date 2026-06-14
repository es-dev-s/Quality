-- Idempotency key for duplicate-safe audit submissions (double-click / retry).
ALTER TABLE "AuditSubmission" ADD COLUMN "submission_key" TEXT;

CREATE UNIQUE INDEX "AuditSubmission_submission_key_key" ON "AuditSubmission"("submission_key");
