"use client";
import type { getAgentTransferHistory } from "@/lib/actions/agent-transfer";
import { transferHistoryQuerySchema } from "@/lib/audit/transfer-history-query";
import { remotePagination,usePageState,useServerResource } from "@/lib/hooks/use-server-resource";

import { AgentTransferModal } from "@/components/admin/agent-transfer-modal";
import { AuditDetailModal } from "@/components/audit-logs/audit-detail-modal";
import { RevertTransferModal } from "@/components/audit-transfer/revert-transfer-modal";
import { HistoryBadge } from "@/components/audit/history-badge";
import { Button } from "@/components/primitives/button";
import {
	DataTablePanel
} from "@/components/primitives/data-table-panel";
import type {
	AgentTransferRow
} from "@/lib/actions/agent-transfer";
import type { AgentListItem } from "@/lib/actions/agents";
import { formatFeedbackDateTime } from "@/lib/audit/feedback-datetime";
import { ArrowRightLeft,Undo2 } from "lucide-react";
import { useMemo,useState } from "react";

type TransferHistoryPanelProps = {
  initialData: Awaited<ReturnType<typeof getAgentTransferHistory>>;
  agents?: AgentListItem[];
  canTransferAgents?: boolean;
  requiresTransferApproval?: boolean;
};

function formatWhen(value: string) {
  return formatFeedbackDateTime(value) || value.slice(0, 10);
}

function transferStatusLabel(status: AgentTransferRow["status"]) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "REVERTED") return "Reverted";
  return "Pending";
}

function transferStatusClass(status: AgentTransferRow["status"]) {
  if (status === "APPROVED") return "platform-tag platform-tag--success";
  if (status === "REJECTED") return "platform-tag platform-tag--danger";
  if (status === "REVERTED") return "platform-tag platform-tag--muted";
  return "platform-tag platform-tag--warning";
}

export function TransferHistoryPanel({
  initialData,
  agents = [],
  canTransferAgents = false,
  requiresTransferApproval = true,
}: TransferHistoryPanelProps) {
  const [transferSearch, setTransferSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [viewAuditId, setViewAuditId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<AgentTransferRow | null>(null);
  const transferState = usePageState(transferSearch);
  const auditState = usePageState(auditSearch);
  const query = useMemo(() => ({ transferSearch, auditSearch, transferPage: transferState.page, transferPageSize: transferState.pageSize, auditPage: auditState.page, auditPageSize: auditState.pageSize }), [transferSearch, auditSearch, transferState.page, transferState.pageSize, auditState.page, auditState.pageSize]);
  const resource = useServerResource("transfers", query, initialData, transferHistoryQuerySchema.parse({}));
  const { transfers, historyAudits } = resource.data;
  const showActions = transfers.some((row) => row.canRevert || row.revertBlockedReason !== null);
  const transferPagination = remotePagination(transfers, resource.data.transferPagination, transferState);
  const auditPagination = remotePagination(historyAudits, resource.data.auditPagination, auditState);

  return (
    <div className="settings-tab-layout">
      <div className="settings-tab-layout__body">
        {resource.error ? <p role="alert">{resource.error}</p> : null}
        <DataTablePanel
          pagination={transferPagination}
          paginationPending={resource.loading}
          summaryLabel={`${resource.data.transferPagination.total} transfer${
            resource.data.transferPagination.total === 1 ? "" : "s"
          }`}
          search={{
            value: transferSearch,
            onChange: setTransferSearch,
            placeholder: "Search transfers…",
            ariaLabel: "Search transfers",
          }}
          headerActions={
            canTransferAgents ? (
              <Button
                size="sm"
                onClick={() => setTransferOpen(true)}
                disabled={agents.length === 0}
              >
                <ArrowRightLeft size={14} />
                Transfer agent
              </Button>
            ) : undefined
          }
          emptyState={
            <p>
              {canTransferAgents
                ? "No agent transfers recorded yet. Use Transfer agent to move someone to another supervisor."
                : "No agent transfers recorded yet."}
            </p>
          }
          renderTable={(slice) => (
            <table className="ui-table platform-report-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Completed</th>
                  <th>Agent</th>
                  <th>From</th>
                  <th>To</th>
                  <th>By</th>
                  <th>Audits</th>
                  <th>Note</th>
                  {showActions ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {slice.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={transferStatusClass(row.status)}>
                        {transferStatusLabel(row.status)}
                      </span>
                      {row.kind === "REVERT" ? (
                        <span
                          className="platform-tag platform-tag--warning"
                          style={{ marginLeft: 6 }}
                        >
                          Revert
                        </span>
                      ) : null}
                    </td>
                    <td>{formatWhen(row.requestedAt)}</td>
                    <td>
                      {row.transferredAt ? formatWhen(row.transferredAt) : "—"}
                    </td>
                    <td>
                      <div>{row.agentName}</div>
                      <div className="dash-cell-muted">{row.agentEmail}</div>
                    </td>
                    <td>{row.fromSupervisorName}</td>
                    <td>{row.toSupervisorName}</td>
                    <td>{row.transferredByName}</td>
                    <td>
                      {row.status === "APPROVED" ? row.auditCountAtTransfer : "—"}
                    </td>
                    <td>
                      <div>{row.note?.trim() || "—"}</div>
                      {row.status === "REVERTED" && row.revertedAt ? (
                        <div className="dash-cell-muted">
                          Reverted {formatWhen(row.revertedAt)}
                          {row.revertedByName ? ` by ${row.revertedByName}` : ""}
                          {row.revertReason ? `: ${row.revertReason}` : ""}
                        </div>
                      ) : null}
                    </td>
                    {showActions ? (
                      <td>
                        {row.canRevert || row.revertBlockedReason ? (
                          <button
                            type="button"
                            className="ui-btn ui-btn--ghost ui-btn--sm"
                            disabled={!row.canRevert}
                            title={
                              row.canRevert
                                ? "Move the agent back to the previous supervisor"
                                : (row.revertBlockedReason ?? undefined)
                            }
                            onClick={() => setRevertTarget(row)}
                          >
                            <Undo2 size={14} />
                            Revert
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />

        <div style={{ marginTop: 32 }}>
          <h3 className="admin-section-head__title" style={{ fontSize: "1rem" }}>
            History audits
          </h3>
        </div>

        <DataTablePanel
          pagination={auditPagination}
          paginationPending={resource.loading}
          summaryLabel={`${resource.data.auditPagination.total} history audit${
            resource.data.auditPagination.total === 1 ? "" : "s"
          }`}
          search={{
            value: auditSearch,
            onChange: setAuditSearch,
            placeholder: "Search history audits…",
            ariaLabel: "Search history audits",
          }}
          emptyState={<p>No history audits linked to transfers yet.</p>}
          renderTable={(slice) => (
            <table className="ui-table platform-report-table">
              <thead>
                <tr>
                  <th>Audit</th>
                  <th>Agent</th>
                  <th>Supervisor</th>
                  <th>Audit date</th>
                  <th>Score</th>
                  <th>Grade</th>
                  <th>Transferred</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {slice.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="audit-logs__code-cell">
                        <span>{row.auditCode}</span>
                        <HistoryBadge />
                      </div>
                    </td>
                    <td>{row.agent}</td>
                    <td>{row.supervisor ?? "—"}</td>
                    <td>{row.auditDate}</td>
                    <td>{row.hasFatal ? 0 : row.finalPct}%</td>
                    <td>{row.grade}</td>
                    <td>{formatWhen(row.transferredAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="ui-btn ui-btn--ghost ui-btn--sm"
                        onClick={() => setViewAuditId(row.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      </div>

      <AuditDetailModal
        auditId={viewAuditId}
        canEditAudits={false}
        canEditSupervisorRemarks={false}
        onClose={() => setViewAuditId(null)}
      />

      <RevertTransferModal
        transfer={revertTarget}
        onClose={() => setRevertTarget(null)}
      />

      {canTransferAgents ? (
        <AgentTransferModal
          agents={agents}
          open={transferOpen}
          requiresApproval={requiresTransferApproval}
          hideHistoryLink
          onOpenChange={setTransferOpen}
        />
      ) : null}
    </div>
  );
}
