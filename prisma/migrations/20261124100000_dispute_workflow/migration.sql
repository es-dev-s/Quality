-- Dispute workflow: SLA-tracked stages, structured team-lead remark,
-- and preserved original versions for revised audits.
ALTER TABLE "AuditSubmission"
  ADD COLUMN IF NOT EXISTS "audit_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "dispute_stage" TEXT,
  ADD COLUMN IF NOT EXISTS "dispute_reason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "dispute_raised_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispute_raised_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "dispute_tl_remark" JSONB,
  ADD COLUMN IF NOT EXISTS "dispute_tl_remark_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispute_tl_remark_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "dispute_reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispute_reviewed_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "dispute_outcome" TEXT,
  ADD COLUMN IF NOT EXISTS "dispute_outcome_note" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "dispute_reshared_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispute_closed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispute_close_reason" TEXT;

CREATE INDEX IF NOT EXISTS "AuditSubmission_dispute_stage_idx"
  ON "AuditSubmission"("dispute_stage");

-- Audits already Disputed before this change enter the workflow at the
-- team-lead step, with the SLA clock starting at the recorded dispute time.
UPDATE "AuditSubmission"
SET "dispute_stage" = 'AWAITING_TL_REMARK',
    "dispute_raised_at" = COALESCE(
      CASE WHEN "feedback_status_at" ~ '^\d{4}-\d{2}-\d{2}'
        THEN ("feedback_status_at"::timestamptz AT TIME ZONE 'UTC')
      END,
      "updatedAt"
    )
WHERE "feedbackStatus" = 'Disputed' AND "dispute_stage" IS NULL;

CREATE TABLE IF NOT EXISTS "audit_revisions" (
  "id" TEXT NOT NULL,
  "audit_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "quality_pct" INTEGER NOT NULL,
  "final_pct" INTEGER NOT NULL,
  "grade" TEXT NOT NULL,
  "has_fatal" BOOLEAN NOT NULL DEFAULT false,
  "scores" JSONB NOT NULL,
  "cat_scores" JSONB NOT NULL,
  "rows" JSONB NOT NULL,
  "record" JSONB NOT NULL,
  "rationale" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "approved_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_revisions_audit_id_fkey" FOREIGN KEY ("audit_id")
    REFERENCES "AuditSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "audit_revisions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "audit_revisions_audit_id_version_key"
  ON "audit_revisions"("audit_id", "version");
CREATE INDEX IF NOT EXISTS "audit_revisions_audit_id_idx" ON "audit_revisions"("audit_id");
