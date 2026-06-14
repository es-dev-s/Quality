"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, UserX } from "lucide-react";
import { AgentFormDialog } from "@/components/admin/agent-form-dialog";
import { BulkActionBar } from "@/components/admin/bulk-action-bar";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Modal } from "@/components/primitives/modal";
import { useToast } from "@/components/primitives/toast";
import {
  bulkDeleteAgents,
  deleteAgent,
  setAgentsActive,
  type AgentListItem,
} from "@/lib/actions/agents";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";

type AgentsTableProps = {
  agents: AgentListItem[];
  canManage: boolean;
  embedded?: boolean;
};

export function AgentsTable({
  agents,
  canManage,
  embedded = false,
}: AgentsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentListItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(q) ||
        (agent.dateOfJoining ?? "").includes(q)
    );
  }, [agents, search]);

  const selectionItems = useMemo(
    () => filtered.map((agent) => ({ id: agent.id })),
    [filtered]
  );

  const {
    selectedCount,
    allVisibleSelected,
    someVisibleSelected,
    toggleOne,
    toggleAllVisible,
    clearSelection,
    isSelected,
    selectedItems,
  } = useBulkSelection(selectionItems);

  const selectedAgents = useMemo(
    () => filtered.filter((agent) => isSelected(agent.id)),
    [filtered, isSelected]
  );

  function openCreate() {
    setEditingAgent(null);
    setDialogOpen(true);
  }

  function openEdit(agent: AgentListItem) {
    setEditingAgent(agent);
    setDialogOpen(true);
  }

  function handleDeleteOne() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteAgent(deleteTarget.id);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Agent deleted", "success");
      setDeleteTarget(null);
      clearSelection();
      router.refresh();
    });
  }

  function handleBulkDelete() {
    startTransition(async () => {
      const ids = selectedAgents.map((agent) => agent.id);
      const result = await bulkDeleteAgents(ids);
      if (result.error && result.deleted === 0) {
        toast(result.error, "error");
        return;
      }
      if (result.deleted > 0) {
        toast(
          `Deleted ${result.deleted} agent${result.deleted === 1 ? "" : "s"}`,
          "success"
        );
      }
      if (result.skipped.length > 0) {
        toast(
          `${result.skipped.length} skipped (audits on record): ${result.skipped
            .map((item) => item.name)
            .join(", ")}`,
          "error"
        );
      }
      setBulkDeleteOpen(false);
      clearSelection();
      router.refresh();
    });
  }

  function handleBulkDeactivate() {
    startTransition(async () => {
      const result = await setAgentsActive(
        selectedAgents.map((agent) => agent.id),
        false
      );
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast(`Deactivated ${result.updated ?? selectedCount} agent(s)`, "success");
      clearSelection();
      router.refresh();
    });
  }

  return (
    <>
      <div className="admin-section-head">
        {!embedded && (
          <div>
            <h2 className="admin-section-head__title">Agents</h2>
            <p className="admin-section-head__desc">
              Manage agents, date of joining, and audit form visibility
            </p>
          </div>
        )}
        {embedded && (
          <p className="admin-section-head__desc">
            DB-backed agent roster used in audit forms and analytics.
          </p>
        )}
        {canManage && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            Add Agent
          </Button>
        )}
      </div>

      <div className="platform-settings__toolbar">
        <div className="platform-settings__search-wrap">
          <Search size={16} className="platform-settings__search-icon" aria-hidden />
          <input
            type="search"
            className="platform-settings__search"
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {canManage && (
        <BulkActionBar
          selectedCount={selectedCount}
          onClear={clearSelection}
          onDelete={() => setBulkDeleteOpen(true)}
          deleteLabel="Delete selected"
          isPending={pending}
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={handleBulkDeactivate}
          >
            <UserX size={14} />
            Deactivate
          </Button>
        </BulkActionBar>
      )}

      <div className="ui-table-wrap">
        <table className="ui-table ui-table--selectable">
          <thead>
            <tr>
              {canManage && (
                <th className="ui-table__check-col">
                  <input
                    type="checkbox"
                    aria-label="Select all visible agents"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected;
                    }}
                    disabled={pending || filtered.length === 0}
                    onChange={toggleAllVisible}
                  />
                </th>
              )}
              <th>Name</th>
              <th>Date of joining</th>
              <th>Audits</th>
              <th>Status</th>
              {canManage && (
                <th style={{ textAlign: "right" }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 6 : 4}
                  className="ui-table__empty"
                >
                  {agents.length === 0
                    ? "No agents yet. Add your first agent."
                    : "No agents match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((agent) => (
                <tr key={agent.id} className={!agent.isActive ? "ui-table__row--muted" : undefined}>
                  {canManage && (
                    <td className="ui-table__check-col">
                      <input
                        type="checkbox"
                        aria-label={`Select ${agent.name}`}
                        checked={isSelected(agent.id)}
                        disabled={pending}
                        onChange={() => toggleOne(agent.id)}
                      />
                    </td>
                  )}
                  <td style={{ fontWeight: 500 }}>{agent.name}</td>
                  <td>{agent.dateOfJoining ?? "—"}</td>
                  <td>{agent.auditCount}</td>
                  <td>
                    <Badge tone={agent.isActive ? "accent" : "neutral"}>
                      {agent.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {canManage && (
                    <td>
                      <div className="ui-table__actions">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          onClick={() => openEdit(agent)}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="danger"
                          size="icon"
                          disabled={pending}
                          onClick={() => setDeleteTarget(agent)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AgentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={editingAgent}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => !pending && setDeleteTarget(null)}
        title="Delete agent"
        description={
          deleteTarget
            ? deleteTarget.auditCount > 0
              ? `"${deleteTarget.name}" has ${deleteTarget.auditCount} audit(s). Deactivate instead of deleting to preserve history.`
              : `Permanently remove "${deleteTarget.name}"? This cannot be undone.`
            : undefined
        }
      >
        <div className="platform-settings__confirm-actions">
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            disabled={pending}
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </button>
          {deleteTarget && deleteTarget.auditCount > 0 ? (
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              disabled={pending}
              onClick={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                startTransition(async () => {
                  const result = await setAgentsActive([target.id], false);
                  if (!result.ok) toast(result.error, "error");
                  else {
                    toast("Agent deactivated", "success");
                    router.refresh();
                  }
                });
              }}
            >
              Deactivate
            </button>
          ) : (
            <button
              type="button"
              className="ui-btn ui-btn--danger"
              disabled={pending}
              onClick={handleDeleteOne}
            >
              Delete
            </button>
          )}
        </div>
      </Modal>

      <Modal
        open={bulkDeleteOpen}
        onClose={() => !pending && setBulkDeleteOpen(false)}
        title="Delete selected agents"
        description="Agents with existing audits are skipped automatically. Others are permanently removed."
      >
        <div className="platform-settings__confirm-actions">
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            disabled={pending}
            onClick={() => setBulkDeleteOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            disabled={pending}
            onClick={handleBulkDelete}
          >
            {pending ? "Deleting…" : `Delete ${selectedCount}`}
          </button>
        </div>
      </Modal>
    </>
  );
}
