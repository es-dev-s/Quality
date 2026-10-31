-- Interaction (call / chat) duration in whole seconds.
-- Nullable so existing and imported audits stay valid; the audit form
-- requires it for every new submission and edit.
ALTER TABLE "AuditSubmission" ADD COLUMN "call_duration_sec" INTEGER;
