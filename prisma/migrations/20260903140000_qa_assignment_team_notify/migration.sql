-- One Quality Analyst per agent. Keep the newest assignment when duplicates exist.
DELETE FROM "agent_assignments" AS a
USING "agent_assignments" AS b
WHERE a.agent_id = b.agent_id
  AND (
    a.assigned_at < b.assigned_at
    OR (a.assigned_at = b.assigned_at AND a.id < b.id)
  );

ALTER TABLE "agent_assignments" DROP CONSTRAINT IF EXISTS "agent_assignments_agent_id_assigned_to_id_key";
DROP INDEX IF EXISTS "agent_assignments_agent_id_assigned_to_id_key";
DROP INDEX IF EXISTS "agent_assignments_agent_id_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "agent_assignments_agent_id_key"
  ON "agent_assignments"("agent_id");

-- Freeze the team that owned an audit so transfers cannot rewrite history.
ALTER TABLE "AuditSubmission"
  ADD COLUMN IF NOT EXISTS "team_name_snapshot" TEXT;

-- One notification per user + type + audit (idempotent fatal/dispute dispatch).
DELETE FROM "notifications" AS a
USING "notifications" AS b
WHERE a.audit_id IS NOT NULL
  AND b.audit_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.type = b.type
  AND a.audit_id = b.audit_id
  AND (
    a.created_at < b.created_at
    OR (a.created_at = b.created_at AND a.id < b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_type_audit_key"
  ON "notifications"("user_id", "type", "audit_id");
