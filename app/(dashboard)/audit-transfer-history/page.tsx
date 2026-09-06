import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";
import { TransferHistoryPanel } from "@/components/audit-transfer/transfer-history-panel";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAgentsForManagement } from "@/lib/actions/agents";
import { getAgentTransferHistory } from "@/lib/actions/agent-transfer";
import { canManageManagedUsers } from "@/lib/rbac";
import { isSupervisorTierRole } from "@/lib/audit/supervisor-tier";

async function TransferHistoryContent() {
  const session = await requirePageAccess("/audit-transfer-history");
  const canTransferAgents =
    canManageManagedUsers(session.user.role) &&
    !isSupervisorTierRole(session.user.role.slug);
  const [{ transfers, historyAudits }, agentsData] = await Promise.all([
    getAgentTransferHistory(),
    canTransferAgents
      ? getAgentsForManagement()
      : Promise.resolve({ agents: [] as Awaited<ReturnType<typeof getAgentsForManagement>>["agents"] }),
  ]);

  return (
    <TransferHistoryPanel
      transfers={transfers}
      historyAudits={historyAudits}
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
