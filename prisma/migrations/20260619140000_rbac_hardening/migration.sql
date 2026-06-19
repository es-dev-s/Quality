-- User activation and approval status
CREATE TYPE "UserApprovalStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'REJECTED');

ALTER TABLE "User" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "approval_status" "UserApprovalStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "User_is_active_idx" ON "User"("is_active");
CREATE INDEX "User_approval_status_idx" ON "User"("approval_status");

-- Agent assignment (QM assigns agent users to supervisor / quality-analyst)
CREATE TABLE "agent_assignments" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "assigned_to_id" TEXT NOT NULL,
  "assigned_by_id" TEXT NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_assignments_agent_id_assigned_to_id_key"
  ON "agent_assignments"("agent_id", "assigned_to_id");
CREATE INDEX "agent_assignments_assigned_to_id_idx" ON "agent_assignments"("assigned_to_id");
CREATE INDEX "agent_assignments_assigned_by_id_idx" ON "agent_assignments"("assigned_by_id");

ALTER TABLE "agent_assignments"
  ADD CONSTRAINT "agent_assignments_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_assignments"
  ADD CONSTRAINT "agent_assignments_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_assignments"
  ADD CONSTRAINT "agent_assignments_assigned_by_id_fkey"
  FOREIGN KEY ("assigned_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Security audit trail (password reads, deactivations, etc.)
CREATE TABLE "security_audit_logs" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "target_user_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_audit_logs_action_idx" ON "security_audit_logs"("action");
CREATE INDEX "security_audit_logs_actor_user_id_idx" ON "security_audit_logs"("actor_user_id");
CREATE INDEX "security_audit_logs_target_user_id_idx" ON "security_audit_logs"("target_user_id");

ALTER TABLE "security_audit_logs"
  ADD CONSTRAINT "security_audit_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "security_audit_logs"
  ADD CONSTRAINT "security_audit_logs_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
