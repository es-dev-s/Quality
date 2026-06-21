"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Badge } from "@/components/primitives/badge";
import { Modal } from "@/components/primitives/modal";
import {
  TableRowAction,
  TableRowActionsCell,
} from "@/components/primitives/table-row-actions";
import { useToast } from "@/components/primitives/toast";
import { RoleAccessMatrix } from "@/components/admin/role-access-matrix";
import { RoleFormDialog } from "@/components/admin/role-form-dialog";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { BulkActionBar } from "@/components/admin/bulk-action-bar";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { bulkDeleteRoles, deleteRole } from "@/lib/actions/admin";

type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  _count: { users: number; scopes: number };
};

type RolesTableProps = {
  roles: Role[];
  embedded?: boolean;
};

export function RolesTable({ roles, embedded = false }: RolesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const pagination = usePaginatedRows(roles);

  const selectionPool = useMemo(
    () => roles.filter((role) => !role.isSystem).map((role) => ({ id: role.id })),
    [roles]
  );

  const visibleSelection = useMemo(
    () =>
      pagination.slice
        .filter((role) => !role.isSystem)
        .map((role) => ({ id: role.id })),
    [pagination.slice]
  );

  const {
    selectedCount,
    selectedIdList,
    allVisibleSelected,
    someVisibleSelected,
    toggleOne,
    toggleAllVisible,
    clearSelection,
    isSelected,
  } = useBulkSelection(selectionPool, visibleSelection);

  function handleBulkDelete() {
    if (selectedIdList.length === 0) {
      toast("No roles selected.", "error");
      return;
    }

    startTransition(async () => {
      const result = await bulkDeleteRoles(selectedIdList);
      if (result.error && !result.deleted) {
        toast(result.error, "error");
        return;
      }
      if (result.deleted) {
        toast(
          `Deleted ${result.deleted} role${result.deleted === 1 ? "" : "s"}`,
          "success"
        );
      }
      if (result.skipped?.length) {
        toast(`Skipped: ${result.skipped.join(", ")}`, "error");
      }
      setBulkDeleteOpen(false);
      clearSelection();
      router.refresh();
    });
  }

  function handleSingleDelete() {
    if (!deleteTarget) return;

    startTransition(async () => {
      const result = await deleteRole(deleteTarget.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast("Role deleted", "success");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <div className={embedded ? "settings-tab-layout" : undefined}>
      <div className={embedded ? "settings-tab-layout__head" : undefined}>
      <RoleAccessMatrix />

      {embedded ? (
        <div className="section-toolbar">
          <span className="section-toolbar__meta">
            {roles.length} role{roles.length === 1 ? "" : "s"}
          </span>
          <div className="section-toolbar__actions">
            <Button
              onClick={() => {
                setEditingRole(null);
                setDialogOpen(true);
              }}
            >
              <Plus size={16} />
              Add Role
            </Button>
          </div>
        </div>
      ) : (
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-head__title">All Roles</h2>
            <p className="admin-section-head__desc">
              System roles ship with predefined module permissions. Custom roles can be added for specialized access.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingRole(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={16} />
            Add Role
          </Button>
        </div>
      )}

      </div>

      <div className={embedded ? "settings-tab-layout__body" : undefined}>
      <BulkActionBar
        selectedCount={selectedCount}
        onClear={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        deleteLabel="Delete selected"
        isPending={pending}
      />

      <LoadingZone
        loading={pending}
        label="Updating roles…"
        className={embedded ? "loading-zone--fill" : undefined}
      >
      {roles.length === 0 ? (
        <div className="ui-table-wrap">
          <table className="ui-table ui-table--selectable platform-report-table">
            <thead>
              <tr>
                <th className="ui-table__check-col" />
                <th>Name</th>
                <th>Slug</th>
                <th>Users</th>
                <th>Scopes</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="ui-table__empty">
                  No roles yet. Create your first role.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <DataTablePanel
          pagination={pagination}
          fillViewport={embedded}
          renderTable={(slice) => (
            <table className="ui-table ui-table--selectable platform-report-table settings-table">
              <thead>
                <tr>
                  <th className="ui-table__check-col">
                    <input
                      type="checkbox"
                      aria-label="Select all roles on this page"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected;
                      }}
                      onChange={toggleAllVisible}
                      disabled={pending || visibleSelection.length === 0}
                    />
                  </th>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Users</th>
                  <th>Scopes</th>
                  <th className="col-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {slice.map((role) => (
                  <tr key={role.id} className="settings-table__row">
                    <td className="ui-table__check-col">
                      {!role.isSystem ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${role.name}`}
                          checked={isSelected(role.id)}
                          disabled={pending}
                          onChange={() => toggleOne(role.id)}
                        />
                      ) : null}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 500 }}>{role.name}</span>
                        {role.isSystem && <Badge tone="accent">System</Badge>}
                      </div>
                      {role.description && (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: "0.75rem",
                            color: "var(--color-muted-fg)",
                          }}
                        >
                          {role.description}
                        </p>
                      )}
                    </td>
                    <td>
                      <code className="ui-code">{role.slug}</code>
                    </td>
                    <td>{role._count.users}</td>
                    <td>{role._count.scopes}</td>
                    <TableRowActionsCell ariaLabel={`Actions for ${role.name}`}>
                      <TableRowAction
                        onClick={() => {
                          setEditingRole(role);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil size={14} aria-hidden />
                        Edit
                      </TableRowAction>
                      <TableRowAction
                        variant="danger"
                        disabled={pending || role.isSystem}
                        onClick={() => setDeleteTarget(role)}
                      >
                        <Trash2 size={14} aria-hidden />
                        Delete
                      </TableRowAction>
                    </TableRowActionsCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      )}
      </LoadingZone>
      </div>

      <Modal
        open={bulkDeleteOpen}
        onClose={() => !pending && setBulkDeleteOpen(false)}
        title="Delete selected roles"
        description={`Delete ${selectedCount} selected role${
          selectedCount === 1 ? "" : "s"
        }? System roles and roles assigned to users are skipped automatically.`}
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
            disabled={pending || selectedCount === 0}
            onClick={handleBulkDelete}
          >
            {pending ? "Deleting…" : `Delete ${selectedCount}`}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !pending && setDeleteTarget(null)}
        title="Delete role"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? Roles assigned to users cannot be removed.`
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
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            disabled={pending}
            onClick={handleSingleDelete}
          >
            {pending ? "Deleting…" : "Delete role"}
          </button>
        </div>
      </Modal>

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editingRole}
      />
    </div>
  );
}
