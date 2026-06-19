import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";
import { AuditLogsTable } from "@/components/dashboard/audit-logs-table";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAuditLogs } from "@/lib/actions/audit";
import type { SessionRole } from "@/lib/rbac";
import {
  canEditAuditSubmissions,
  canEditFeedbackDate,
  canEditFeedbackFully,
  canEditSupervisorRemarks,
  canDeleteAuditLogs,
  isSuperAdmin,
} from "@/lib/rbac";

async function AuditLogsContent() {
  const session = await requirePageAccess("/audit-logs");
  const { submissions } = await getAuditLogs();
  return (
    <AuditLogsTable
      submissions={submissions}
      showSectionHead={false}
      feedbackStatusRole={session.user.role}
      canEditFeedbackFully={canEditFeedbackFully(session.user.role)}
      canEditFeedbackDate={canEditFeedbackDate(session.user.role)}
      canEditSupervisorRemarks={canEditSupervisorRemarks(session.user.role)}
      canEditAudits={canEditAuditSubmissions(session.user.role)}
      canDeleteAudits={canDeleteAuditLogs(session.user.role)}
      isSuperAdmin={isSuperAdmin(session.user.role)}
    />
  );
}

export default function AuditLogsPage() {
  return (
    <PageFrame>
      <Suspense fallback={<TablePageSkeleton rows={12} />}>
        <AuditLogsContent />
      </Suspense>
    </PageFrame>
  );
}
