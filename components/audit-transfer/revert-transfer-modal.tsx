"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalActions, FormStack } from "@/components/primitives/modal";
import { Button } from "@/components/primitives/button";
import { Label } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import {
  getAgentTransferRevertPreview,
  revertAgentTransfer,
  type AgentTransferRow,
} from "@/lib/actions/agent-transfer";
import type { RevertPreview } from "@/lib/agent-transfer/engine";
import { formatFeedbackDateTime } from "@/lib/audit/feedback-datetime";

const MIN_REASON = 5;

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

type RevertTransferModalProps = {
  transfer: AgentTransferRow | null;
  onClose: () => void;
};

export function RevertTransferModal({ transfer, onClose }: RevertTransferModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<RevertPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  // One key per dialog opening: double-clicks / retries reuse it.
  const idempotencyKey = useRef<string>("");

  const transferId = transfer?.id ?? null;

  useEffect(() => {
    if (!transferId) return;
    idempotencyKey.current = newIdempotencyKey();
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset per opened transfer
    setLoading(true);
    setPreview(null);
    setLoadError(null);
    setReason("");
    getAgentTransferRevertPreview(transferId)
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) setLoadError(result.error);
        else setPreview(result.preview);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load the revert preview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [transferId]);

  const trimmed = reason.trim();
  const canSubmit =
    Boolean(preview?.eligible) && trimmed.length >= MIN_REASON && !pending && !loading;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transfer || !preview || !canSubmit) return;
    startTransition(async () => {
      const result = await revertAgentTransfer({
        transferId: transfer.id,
        reason: trimmed,
        idempotencyKey: idempotencyKey.current,
        expectedVersion: preview.version,
      });
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }
      if ("success" in result && result.success) {
        toast(result.message, "success");
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={Boolean(transfer)}
      onClose={() => !pending && onClose()}
      title="Revert agent transfer"
      size="md"
      description={
        transfer
          ? `Move ${transfer.agentName} back from ${transfer.toSupervisorName} to ${transfer.fromSupervisorName}.`
          : undefined
      }
    >
      <form onSubmit={handleSubmit}>
        {loading ? <p className="ui-hint">Loading impact…</p> : null}
        {loadError ? <p className="ui-form-error">{loadError}</p> : null}
        {preview ? (
          <FormStack>
            {!preview.eligible && preview.blockedReason ? (
              <p className="ui-form-error">{preview.blockedReason}</p>
            ) : null}
            <div className="ui-hint" data-testid="revert-impact">
              <p>
                <strong>{preview.agentName}</strong> returns to{" "}
                <strong>{preview.fromSupervisorName}</strong>
                {preview.fromTeamName ? ` (${preview.fromTeamName})` : ""}.
              </p>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                <li>
                  {plural(preview.restoreAuditCount, "audit")} from before the
                  transfer become working audits again for the previous team.
                </li>
                <li>
                  {plural(preview.holdAuditCount, "audit")} created under{" "}
                  {preview.toSupervisorName} stay with that team as read-only
                  history.
                </li>
                <li>
                  {preview.restoreQaName
                    ? preview.restoreQaActive
                      ? `QA assignment returns to ${preview.restoreQaName}.`
                      : `Previous QA ${preview.restoreQaName} is inactive, so no QA will be assigned.`
                    : "No QA was assigned before the transfer; the current QA assignment is removed."}
                </li>
              </ul>
              {preview.windowEndsAt ? (
                <p style={{ marginTop: 8 }}>
                  Revert available until{" "}
                  {formatFeedbackDateTime(preview.windowEndsAt) || preview.windowEndsAt}.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="revert-reason">Reason (required)</Label>
              <textarea
                id="revert-reason"
                className="ui-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending || !preview.eligible}
                rows={3}
                maxLength={2000}
                placeholder="e.g. Transferred to the wrong team by mistake"
              />
              {trimmed.length > 0 && trimmed.length < MIN_REASON ? (
                <p className="ui-hint">Please write at least {MIN_REASON} characters.</p>
              ) : null}
            </div>
          </FormStack>
        ) : null}
        <ModalActions>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={!canSubmit}>
            {pending ? "Reverting…" : "Revert transfer"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
