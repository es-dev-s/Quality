import { AuditLogsTable } from "@/components/dashboard/audit-logs-table";
import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";
import { getAuditLogs } from "@/lib/actions/audit";
import { auditLogQuerySchema } from "@/lib/audit/log-query";
import { resolveMemberFeedbackMode } from "@/lib/audit/member-access";
import { requirePageAccess } from "@/lib/auth-guards";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import {
	canDeleteAuditLogs,
	canEditAuditSubmissions,
	canEditFeedbackDate,
	canEditFeedbackFully,
	canEditSupervisorRemarks,
	canExportAuditData,
	canWriteAuditForm,
	isSuperAdmin,
} from "@/lib/rbac";
import { Suspense } from "react";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function AuditLogsContent({ searchParams }: { searchParams: SearchParams }) {
  const parsed = auditLogQuerySchema.safeParse(await searchParams);
  const session = await requirePageAccess("/audit-logs");
  const [initialPage, memberFeedbackMode] = await Promise.all([
    getAuditLogs(parsed.success ? parsed.data : {}),
    session.user.role.slug === SYSTEM_ROLE_SLUGS.MEMBER
      ? resolveMemberFeedbackMode(session.user.id)
      : Promise.resolve(undefined),
  ]);
  return (
    <AuditLogsTable
      initialPage={initialPage}
      roleSlug={session.user.role.slug}
      showSectionHead={false}
      feedbackStatusRole={session.user.role}
      memberFeedbackMode={memberFeedbackMode}
      canEditFeedbackFully={canEditFeedbackFully(session.user.role)}
      canEditFeedbackDate={canEditFeedbackDate(session.user.role)}
      canEditSupervisorRemarks={canEditSupervisorRemarks(session.user.role)}
      canEditAudits={canEditAuditSubmissions(session.user.role)}
      canDeleteAudits={canDeleteAuditLogs(session.user.role)}
      canCreateAudit={canWriteAuditForm(session.user.role)}
      canExport={canExportAuditData(session.user.role)}
      isSuperAdmin={isSuperAdmin(session.user.role)}
    />
  );
}

export default function AuditLogsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PageFrame>
      <Suspense fallback={<TablePageSkeleton rows={12} />}>
        <AuditLogsContent searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}
