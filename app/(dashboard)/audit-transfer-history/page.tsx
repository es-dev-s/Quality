import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";
import { TransferHistoryPanel } from "@/components/audit-transfer/transfer-history-panel";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAgentTransferHistory } from "@/lib/actions/agent-transfer";

async function TransferHistoryContent() {
  await requirePageAccess("/audit-transfer-history");
  const { transfers, historyAudits } = await getAgentTransferHistory();

  return (
    <TransferHistoryPanel
      transfers={transfers}
      historyAudits={historyAudits}
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
