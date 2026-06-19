-- Performance indexes for scoped filters, sorts, and keyset pagination

CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "User"("roleId");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX IF NOT EXISTS "User_roleId_is_active_idx" ON "User"("roleId", "is_active");

CREATE INDEX IF NOT EXISTS "AuditSubmission_feedbackStatus_idx" ON "AuditSubmission"("feedbackStatus");
CREATE INDEX IF NOT EXISTS "AuditSubmission_submittedById_auditDate_idx" ON "AuditSubmission"("submittedById", "auditDate");
CREATE INDEX IF NOT EXISTS "AuditSubmission_templateId_auditDate_idx" ON "AuditSubmission"("template_id", "auditDate");
CREATE INDEX IF NOT EXISTS "AuditSubmission_id_createdAt_idx" ON "AuditSubmission"("id", "createdAt");

CREATE INDEX IF NOT EXISTS "agent_assignments_agent_id_idx" ON "agent_assignments"("agent_id");
