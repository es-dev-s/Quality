-- CreateTable
CREATE TABLE "AuditSubmission" (
    "id" TEXT NOT NULL,
    "auditCode" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "supervisor" TEXT,
    "auditor" TEXT,
    "type" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "callDate" TEXT NOT NULL,
    "auditDate" TEXT NOT NULL,
    "lob" TEXT NOT NULL,
    "sublob" TEXT,
    "reason" TEXT,
    "mobile" TEXT,
    "response" TEXT,
    "qualityPct" INTEGER NOT NULL,
    "finalPct" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "hasFatal" BOOLEAN NOT NULL DEFAULT false,
    "fatalList" JSONB NOT NULL DEFAULT '[]',
    "feedbackStatus" TEXT NOT NULL DEFAULT 'Pending',
    "totalScored" DOUBLE PRECISION NOT NULL,
    "totalMax" DOUBLE PRECISION NOT NULL,
    "scores" JSONB NOT NULL,
    "catScores" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "record" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditSubmission_auditCode_key" ON "AuditSubmission"("auditCode");

-- CreateIndex
CREATE INDEX "AuditSubmission_agent_idx" ON "AuditSubmission"("agent");

-- CreateIndex
CREATE INDEX "AuditSubmission_lob_idx" ON "AuditSubmission"("lob");

-- CreateIndex
CREATE INDEX "AuditSubmission_grade_idx" ON "AuditSubmission"("grade");

-- CreateIndex
CREATE INDEX "AuditSubmission_createdAt_idx" ON "AuditSubmission"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditSubmission" ADD CONSTRAINT "AuditSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
