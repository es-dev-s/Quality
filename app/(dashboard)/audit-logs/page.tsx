import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";
import { AuditLogsTable } from "@/components/dashboard/audit-logs-table";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAuditLogs } from "@/lib/actions/audit";
import {
  canEditFeedbackFully,
  canEditFeedbackStatus,
  canWriteAuditLogs,
} from "@/lib/rbac";

async function AuditLogsContent() {
  const session = await requirePageAccess("/audit-logs");
  const { submissions } = await getAuditLogs();
  return (
    <AuditLogsTable
      submissions={submissions}
      canEditFeedbackStatus={canEditFeedbackStatus(session.user.role)}
      canEditFeedbackFully={canEditFeedbackFully(session.user.role)}
      canEditAudits={canWriteAuditLogs(session.user.role)}
    />
  );
}

export default function AuditLogsPage() {
  return (
    <PageFrame
      title="Audit Logs"
      description="Browse recent saved audits, scores, and submission history"
    >
      <Suspense fallback={<TablePageSkeleton rows={12} />}>
        <AuditLogsContent />
      </Suspense>
    </PageFrame>
  );
}
