import { TransferHistoryPanel } from "@/components/audit-transfer/transfer-history-panel";
import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";
import { getAgentTransferHistory } from "@/lib/actions/agent-transfer";
import { getAgentsForManagement } from "@/lib/actions/agents";
import { isSupervisorTierRole } from "@/lib/audit/supervisor-tier";
import { requirePageAccess } from "@/lib/auth-guards";
import { canManageManagedUsers } from "@/lib/rbac";
import { Suspense } from "react";

async function TransferHistoryContent() {
  const session = await requirePageAccess("/audit-transfer-history");
  // Supervisors can request transfers (QM approval required); QM / superadmin
  // transfer directly.
  const canTransferAgents = canManageManagedUsers(session.user.role);
  const [initialData, agentsData] = await Promise.all([
    getAgentTransferHistory(),
    canTransferAgents
      ? getAgentsForManagement()
      : Promise.resolve({ agents: [] as Awaited<ReturnType<typeof getAgentsForManagement>>["agents"] }),
  ]);

  return (
    <TransferHistoryPanel
      initialData={initialData}
      agents={agentsData.agents}
      canTransferAgents={canTransferAgents}
      requiresTransferApproval={isSupervisorTierRole(session.user.role.slug)}
    />
  );
}

export default function AuditTransferHistoryPage() {
  return (
    <PageFrame>
      <Suspense fallback={<TablePageSkeleton rows={10} />}>
        <TransferHistoryContent />
      </Suspense>
    </PageFrame>
  );
}
