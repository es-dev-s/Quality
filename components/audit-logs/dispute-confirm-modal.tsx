"use client";

import { Button } from "@/components/primitives/button";
import { Modal, ModalActions } from "@/components/primitives/modal";
import { DISPUTE_SLA_HOURS, DISPUTE_TEXT_LIMITS } from "@/lib/audit/dispute";
import { useState } from "react";

type DisputeConfirmModalProps = {
  open: boolean;
  auditCode?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

/**
 * Warning shown before an agent disputes feedback, so a stray dropdown click
 * cannot start a dispute by accident.
 */
export function DisputeConfirmModal(props: DisputeConfirmModalProps) {
  // Mount the form only while open so the reason/checkbox reset on every open.
  return props.open ? <DisputeConfirmForm {...props} /> : null;
}

function DisputeConfirmForm({
  open,
  auditCode,
  loading = false,
  onClose,
  onConfirm,
}: DisputeConfirmModalProps) {
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const reasonOk = reason.trim().length >= DISPUTE_TEXT_LIMITS.reason.min;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      title="Dispute this audit feedback?"
      description={auditCode ? `Audit ${auditCode}` : undefined}
      className="ui-modal-panel--confirm"
    >
      <div className="dispute-warning" role="alert">
        <div>
          <strong>Raise a dispute only if you believe the audit is wrong.</strong>
          <ul>
            <li>Your team lead must respond within {DISPUTE_SLA_HOURS.teamLeadRemark} hours.</li>
            <li>
              The Quality Manager then reviews it within {DISPUTE_SLA_HOURS.qualityManagerReview} hours.
            </li>
            <li>
              If you only want to accept the feedback, choose <em>Acknowledged</em> instead.
            </li>
          </ul>
        </div>
      </div>

      <label className="dispute-panel__label" htmlFor="dispute-reason" style={{ marginTop: 12 }}>
        Why are you disputing? (required)
      </label>
      <textarea
        id="dispute-reason"
        className="adi-remarks-input"
        rows={4}
        maxLength={DISPUTE_TEXT_LIMITS.reason.max}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain which scores or parameters you disagree with…"
        disabled={loading}
      />

      <label style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          disabled={loading}
        />
        I understand this starts a formal dispute review.
      </label>

      <ModalActions>
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={loading}
          disabled={!reasonOk || !acknowledged || loading}
          onClick={() => onConfirm(reason.trim())}
        >
          Raise dispute
        </Button>
      </ModalActions>
    </Modal>
  );
}
