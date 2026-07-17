"use client";

import { useMemo, useState } from "react";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";
import { HistoryBadge } from "@/components/audit/history-badge";
import { AuditDetailModal } from "@/components/audit-logs/audit-detail-modal";
import type {
  AgentTransferRow,
  TransferHistoryAuditRow,
} from "@/lib/actions/agent-transfer";
import { formatFeedbackDateTime } from "@/lib/audit/feedback-datetime";

type TransferHistoryPanelProps = {
  transfers: AgentTransferRow[];
  historyAudits: TransferHistoryAuditRow[];
};

function formatWhen(value: string) {
  return formatFeedbackDateTime(value) || value.slice(0, 10);
}

function transferStatusLabel(status: AgentTransferRow["status"]) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Pending";
}

function transferStatusClass(status: AgentTransferRow["status"]) {
  if (status === "APPROVED") return "platform-tag platform-tag--success";
  if (status === "REJECTED") return "platform-tag platform-tag--danger";
  return "platform-tag platform-tag--warning";
}

export function TransferHistoryPanel({
  transfers,
  historyAudits,
}: TransferHistoryPanelProps) {
  const [transferSearch, setTransferSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [viewAuditId, setViewAuditId] = useState<string | null>(null);

  const filteredTransfers = useMemo(() => {
    const q = transferSearch.trim().toLowerCase();
    if (!q) return transfers;
    return transfers.filter((row) =>
      [
        row.agentName,
        row.agentEmail,
        row.fromSupervisorName,
        row.toSupervisorName,
        row.transferredByName,
        row.status,
        row.note ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [transfers, transferSearch]);

  const filteredAudits = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return historyAudits;
    return historyAudits.filter((row) =>
      [row.auditCode, row.agent, row.supervisor ?? "", row.grade]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [historyAudits, auditSearch]);

  const transferPagination = usePaginatedRows(filteredTransfers);
  const auditPagination = usePaginatedRows(filteredAudits);

  return (
    <div className="settings-tab-layout">
      <div className="admin-section-head">
        <div>
          <h2 className="admin-section-head__title">Audit Transfer History</h2>
          <p className="admin-section-head__desc">
            Transfers log who moved an agent between supervisors. Supervisor
            requests stay pending until a quality manager approves them. History
            audits are read-only snapshots retained by the previous supervisor.
          </p>
        </div>
      </div>

      <div className="settings-tab-layout__body">
        <DataTablePanel
          pagination={transferPagination}
          summaryLabel={`${filteredTransfers.length} transfer${
            filteredTransfers.length === 1 ? "" : "s"
          }`}
          search={{
            value: transferSearch,
            onChange: setTransferSearch,
            placeholder: "Search transfers…",
            ariaLabel: "Search transfers",
          }}
          emptyState={<p>No agent transfers recorded yet.</p>}
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
                </tr>
              </thead>
              <tbody>
                {slice.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={transferStatusClass(row.status)}>
                        {transferStatusLabel(row.status)}
                      </span>
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
                    <td>{row.note?.trim() || "—"}</td>
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
          <p className="admin-section-head__desc">
            Read-only audits tagged when an agent was transferred away.
          </p>
        </div>

        <DataTablePanel
          pagination={auditPagination}
          summaryLabel={`${filteredAudits.length} history audit${
            filteredAudits.length === 1 ? "" : "s"
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
    </div>
  );
}
