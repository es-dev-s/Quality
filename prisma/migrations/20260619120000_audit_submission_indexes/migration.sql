-- Add indexes for common AuditSubmission query filters
CREATE INDEX "AuditSubmission_submittedById_idx" ON "AuditSubmission"("submittedById");
CREATE INDEX "AuditSubmission_templateId_idx" ON "AuditSubmission"("template_id");
CREATE INDEX "AuditSubmission_auditor_idx" ON "AuditSubmission"("auditor");
CREATE INDEX "AuditSubmission_auditDate_idx" ON "AuditSubmission"("auditDate");
