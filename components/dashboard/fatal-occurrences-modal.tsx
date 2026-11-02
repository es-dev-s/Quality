"use client";

import { AuditDetailModal } from "@/components/audit-logs/audit-detail-modal";
import { LoadingIndicator } from "@/components/primitives/loading-zone";
import { Modal } from "@/components/primitives/modal";
import { PageControls } from "@/components/primitives/page-controls";
import type { FatalOccurrenceRow } from "@/lib/audit/dashboard-metrics";
import { resolveMetricDate } from "@/lib/audit/metric-dates";
import { pageInfo,type PageInfo } from "@/lib/server/page-query";
import { FileText } from "lucide-react";
import { useState } from "react";

type FatalOccurrencesModalProps = {
  fatalName: string | null;
  title?: string;
  description?: string;
  occurrences: FatalOccurrenceRow[];
  pagination?: PageInfo;
  onPage?: (page: number) => void;
  loading?: boolean;
  canEditAudits?: boolean;
  canEditSupervisorRemarks?: boolean;
  onClose: () => void;
};

function formatDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function FatalOccurrencesModal({
  fatalName,
  title,
  description,
  occurrences,
  pagination: remotePage,
  onPage,
  loading = false,
  canEditAudits = false,
  canEditSupervisorRemarks = false,
  onClose,
}: FatalOccurrencesModalProps) {
  const open = Boolean(fatalName);
  const [localPage, setLocalPage] = useState(1);
  const pagination = remotePage ?? pageInfo(occurrences.length, { page: localPage, pageSize: 20 });
  const rows = remotePage ? occurrences : occurrences.slice(pagination.start - 1, pagination.end);
  const [viewAuditId, setViewAuditId] = useState<string | null>(null);

  function handleClose() {
    setViewAuditId(null);
    onClose();
  }

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={title ?? fatalName ?? "Fatal error details"}
        description={
          description ??
          `${pagination.total} audit${pagination.total === 1 ? "" : "s"} with this fatal parameter in the selected period`
        }
        className="dash-fatal-modal"
        rootClassName={viewAuditId ? "ui-modal-root--underlay" : undefined}
      >
        {loading ? <LoadingIndicator label="Loading audits�" /> : occurrences.length === 0 ? (
          <p className="dash-empty">No matching audits found.</p>
        ) : (
          <div className="ui-table-wrap dash-fatal-modal__table-wrap">
            <table className="ui-table dash-fatal-modal__table">
              <thead>
                <tr>
                  <th>Audit</th>
                  <th>Agent</th>
                  <th>Team</th>
                  <th>Auditor</th>
                  <th>LOB</th>
                  <th>Type</th>
                  <th>Audit date</th>
                  <th>Quality</th>
                  <th>Final</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="dash-fatal-modal__code">{row.auditCode}</td>
                    <td className="dash-fatal-modal__strong">{row.agent}</td>
                    <td>{row.supervisor ?? "—"}</td>
                    <td>{row.auditor ?? "—"}</td>
                    <td>{row.lob}</td>
                    <td>{row.type}</td>
                    <td>
                      {formatDate(
                        resolveMetricDate(row.auditDate, row.callDate)
                      )}
                    </td>
                    <td>{row.qualityPct}%</td>
                    <td className="dash-fatal-modal__final">{row.finalPct}%</td>
                    <td className="col-actions dash-fatal-modal__actions">
                      <button
                        type="button"
                        className="ui-btn ui-btn--sm ui-btn--ghost dash-fatal-modal__view-btn"
                        title="View audit details"
                        onClick={() => setViewAuditId(row.id)}
                      >
                        <FileText size={14} aria-hidden />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PageControls pagination={pagination} onPage={onPage ?? setLocalPage} loading={loading} />
      </Modal>

      <AuditDetailModal
        auditId={viewAuditId}
        canEditAudits={canEditAudits}
        canEditSupervisorRemarks={canEditSupervisorRemarks}
        elevated
        onClose={() => setViewAuditId(null)}
      />
    </>
  );
}
