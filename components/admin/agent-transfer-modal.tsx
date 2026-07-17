"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal, ModalActions, FormStack } from "@/components/primitives/modal";
import { Button } from "@/components/primitives/button";
import { Label, Select } from "@/components/primitives/field";
import { FilterSelect } from "@/components/filters/filter-select";
import { useToast } from "@/components/primitives/toast";
import {
  countPendingHistoryAuditsForAgent,
  listTransferTargetSupervisors,
  transferAgentToSupervisor,
  type TransferTargetSupervisor,
} from "@/lib/actions/agent-transfer";
import type { AgentListItem } from "@/lib/actions/agents";

type AgentTransferModalProps = {
  agent: AgentListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiresApproval?: boolean;
};

export function AgentTransferModal({
  agent,
  open,
  onOpenChange,
  requiresApproval = true,
}: AgentTransferModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [supervisors, setSupervisors] = useState<TransferTargetSupervisor[]>([]);
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [auditCount, setAuditCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !agent) {
      setTargetId("");
      setNote("");
      setAuditCount(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      const [targets, count] = await Promise.all([
        listTransferTargetSupervisors(),
        countPendingHistoryAuditsForAgent(agent.id),
      ]);
      if (cancelled) return;

      if ("error" in targets) {
        setLoadError(targets.error);
        setSupervisors([]);
      } else {
        setSupervisors(targets.supervisors);
        setLoadError(null);
      }
      setAuditCount(count);
    });

    return () => {
      cancelled = true;
    };
  }, [open, agent]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !targetId) return;

    startTransition(async () => {
      const result = await transferAgentToSupervisor({
        agentUserId: agent.id,
        toSupervisorId: targetId,
        note: note.trim() || undefined,
      });

      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }

      if ("success" in result && result.success) {
        toast(
          result.message ?? "Agent transferred successfully.",
          "success"
        );
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  const targetOptions = supervisors.map((supervisor) => ({
    value: supervisor.id,
    label: supervisor.teamName
      ? `${supervisor.name} (${supervisor.teamName})`
      : supervisor.name,
  }));

  return (
    <Modal
      open={open}
      onClose={() => !pending && onOpenChange(false)}
      title="Transfer agent"
      size="md"
      description={
        agent
          ? requiresApproval
            ? `Request to move ${agent.name} to another supervisor. A quality manager must approve before the transfer completes. Past audits stay with you as read-only history once approved.`
            : `Move ${agent.name} to another supervisor. Past audits stay with you as read-only history.`
          : undefined
      }
    >
      {loadError ? (
        <p className="ui-form-error">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormStack>
            <div>
              <Label htmlFor="transfer-target">New supervisor</Label>
              <FilterSelect
                id="transfer-target"
                value={targetId}
                onChange={setTargetId}
                ariaLabel="New supervisor"
                options={[
                  { value: "", label: "Select supervisor" },
                  ...targetOptions,
                ]}
              />
              {targetOptions.length === 0 && !pending ? (
                <p className="ui-hint">No other active supervisors available.</p>
              ) : null}
            </div>

            {auditCount !== null ? (
              <p className="ui-hint">
                {auditCount} audit{auditCount === 1 ? "" : "s"} will be marked as
                history and remain visible to the previous supervisor
                {requiresApproval ? " once approved" : ""}.
              </p>
            ) : null}

            <div>
              <Label htmlFor="transfer-note">Note (optional)</Label>
              <textarea
                id="transfer-note"
                className="ui-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={pending}
                rows={3}
                maxLength={2000}
                placeholder="Reason for transfer"
              />
            </div>
          </FormStack>

          <ModalActions>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !targetId || targetOptions.length === 0}
            >
              {pending
                ? requiresApproval
                  ? "Submitting…"
                  : "Transferring…"
                : requiresApproval
                  ? "Request transfer"
                  : "Transfer agent"}
            </Button>
          </ModalActions>

          <p className="ui-hint" style={{ marginTop: 12 }}>
            View transfers on{" "}
            <Link href="/audit-transfer-history">Audit Transfer History</Link>.
          </p>
        </form>
      )}
    </Modal>
  );
}
