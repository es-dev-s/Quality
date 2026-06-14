"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Badge } from "@/components/primitives/badge";
import { Modal } from "@/components/primitives/modal";
import { useToast } from "@/components/primitives/toast";
import { RoleAccessMatrix } from "@/components/admin/role-access-matrix";
import { RoleFormDialog } from "@/components/admin/role-form-dialog";
import { BulkActionBar } from "@/components/admin/bulk-action-bar";
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

  const selectionItems = useMemo(
    () => roles.filter((role) => !role.isSystem).map((role) => ({ id: role.id })),
    [roles]
  );

  const {
    selectedCount,
    allVisibleSelected,
    someVisibleSelected,
    toggleOne,
    toggleAllVisible,
    clearSelection,
    isSelected,
  } = useBulkSelection(selectionItems);

  const selectedIds = useMemo(
    () => selectionItems.filter((item) => isSelected(item.id)).map((item) => item.id),
    [selectionItems, isSelected]
  );

  function handleDelete(roleId: string) {
    if (!confirm("Are you sure you want to delete this role?")) return;

    startTransition(async () => {
      const result = await deleteRole(roleId);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast("Role deleted", "success");
      router.refresh();
    });
  }

  function handleBulkDelete() {
    startTransition(async () => {
      const result = await bulkDeleteRoles(selectedIds);
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

  return (
    <>
      <RoleAccessMatrix />

      <div className="admin-section-head">
        {!embedded && (
          <div>
            <h2 className="admin-section-head__title">All Roles</h2>
            <p className="admin-section-head__desc">
              System roles ship with predefined module permissions. Custom roles can be added for specialized access.
            </p>
          </div>
        )}
        {embedded && (
          <p className="admin-section-head__desc">
            Predefined system roles control module access. User and role management is super admin only.
          </p>
        )}
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

      <BulkActionBar
        selectedCount={selectedCount}
        onClear={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        deleteLabel="Delete selected"
        isPending={pending}
      />

      <div className="ui-table-wrap">
        <table className="ui-table ui-table--selectable">
          <thead>
            <tr>
              <th className="ui-table__check-col">
                <input
                  type="checkbox"
                  aria-label="Select all roles"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleAllVisible}
                  disabled={pending || selectionItems.length === 0}
                />
              </th>
              <th>Name</th>
              <th>Slug</th>
              <th>Users</th>
              <th>Scopes</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={6} className="ui-table__empty">
                  No roles yet. Create your first role.
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id}>
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
                  <td>
                    <div className="ui-table__actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingRole(role);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="danger"
                        size="icon"
                        disabled={pending || role.isSystem}
                        onClick={() => handleDelete(role.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={bulkDeleteOpen}
        onClose={() => !pending && setBulkDeleteOpen(false)}
        title="Delete selected roles"
        description="System roles and roles assigned to users are skipped automatically."
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

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editingRole}
      />
    </>
  );
}
