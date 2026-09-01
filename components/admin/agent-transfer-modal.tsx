"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal, ModalActions, FormStack } from "@/components/primitives/modal";
import { Button } from "@/components/primitives/button";
import { Label } from "@/components/primitives/field";
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
  agent?: AgentListItem | null;
  agents?: AgentListItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiresApproval?: boolean;
  hideHistoryLink?: boolean;
};

export function AgentTransferModal({
  agent = null,
  agents = [],
  open,
  onOpenChange,
  requiresApproval = true,
  hideHistoryLink = false,
}: AgentTransferModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [supervisors, setSupervisors] = useState<TransferTargetSupervisor[]>([]);
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [auditCount, setAuditCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const lockedAgent = agent;
  const resolvedAgent =
    lockedAgent ?? agents.find((entry) => entry.id === selectedAgentId) ?? null;
  const showAgentPicker = !lockedAgent && agents.length > 0;
  const agentOptions = agents.map((entry) => ({
    value: entry.id,
    label: entry.pendingTransfer
      ? `${entry.name} (pending transfer)`
      : entry.teamName
        ? `${entry.name} (${entry.teamName})`
        : entry.name,
    disabled: Boolean(entry.pendingTransfer),
  }));

  useEffect(() => {
    if (!open) {
      setSelectedAgentId("");
      setTargetId("");
      setNote("");
      setAuditCount(null);
      setLoadError(null);
      setSupervisors([]);
      return;
    }

    if (lockedAgent) {
      setSelectedAgentId(lockedAgent.id);
    }
  }, [open, lockedAgent]);

  useEffect(() => {
    if (!open || !resolvedAgent) {
      setTargetId("");
      setAuditCount(null);
      setLoadError(null);
      setSupervisors([]);
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      const [targets, count] = await Promise.all([
        listTransferTargetSupervisors(),
        countPendingHistoryAuditsForAgent(resolvedAgent.id),
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
  }, [open, resolvedAgent?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedAgent || !targetId || resolvedAgent.pendingTransfer) return;

    startTransition(async () => {
      const result = await transferAgentToSupervisor({
        agentUserId: resolvedAgent.id,
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
        resolvedAgent
          ? requiresApproval
            ? `Request to move ${resolvedAgent.name} to another supervisor. A quality manager must approve before the transfer completes. Past audits stay with you as read-only history once approved.`
            : `Move ${resolvedAgent.name} to another supervisor. Past audits stay with you as read-only history.`
          : "Select an agent, then choose the supervisor they should move to."
      }
    >
      <form onSubmit={handleSubmit}>
          {loadError ? <p className="ui-form-error">{loadError}</p> : null}
          <FormStack>
            {showAgentPicker ? (
              <div>
                <Label htmlFor="transfer-agent">Agent</Label>
                <FilterSelect
                  id="transfer-agent"
                  value={selectedAgentId}
                  onChange={(value) => {
                    setSelectedAgentId(value);
                    setTargetId("");
                    setAuditCount(null);
                  }}
                  ariaLabel="Agent to transfer"
                  options={[
                    { value: "", label: "Select agent" },
                    ...agentOptions,
                  ]}
                />
              </div>
            ) : null}

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
              {resolvedAgent && targetOptions.length === 0 && !pending ? (
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
              disabled={
                pending ||
                Boolean(loadError) ||
                !resolvedAgent ||
                Boolean(resolvedAgent.pendingTransfer) ||
                !targetId ||
                targetOptions.length === 0
              }
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

          {hideHistoryLink ? null : (
            <p className="ui-hint" style={{ marginTop: 12 }}>
              View transfers on{" "}
              <Link href="/audit-transfer-history">Audit Transfer History</Link>.
            </p>
          )}
        </form>
    </Modal>
  );
}
