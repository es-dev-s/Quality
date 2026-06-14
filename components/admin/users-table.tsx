"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { BulkActionBar } from "@/components/admin/bulk-action-bar";
import { Button } from "@/components/primitives/button";
import { Badge } from "@/components/primitives/badge";
import { Modal } from "@/components/primitives/modal";
import { useToast } from "@/components/primitives/toast";
import { UserFormDialog } from "@/components/admin/user-form-dialog";
import { bulkDeleteUsers } from "@/lib/actions/admin";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";

type Role = {
  id: string;
  name: string;
  slug: string;
  isSystem?: boolean;
  _count?: { scopes: number };
};

type User = {
  id: string;
  name: string | null;
  email: string;
  roleId: string;
  role: Role;
  dateOfJoining?: string | null;
  createdAt: Date;
};

type UsersTableProps = {
  users: User[];
  roles: Role[];
  embedded?: boolean;
};

export function UsersTable({ users, roles, embedded = false }: UsersTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const selectionItems = useMemo(
    () => users.map((user) => ({ id: user.id })),
    [users]
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
    () => users.filter((user) => isSelected(user.id)).map((user) => user.id),
    [users, isSelected]
  );

  function handleBulkDelete() {
    startTransition(async () => {
      const result = await bulkDeleteUsers(selectedIds);
      if (result.error && !result.deleted) {
        toast(result.error, "error");
        return;
      }
      if (result.deleted) {
        toast(
          `Deleted ${result.deleted} user${result.deleted === 1 ? "" : "s"}`,
          "success"
        );
      }
      if (result.skipped?.length) {
        toast(
          `${result.skipped.length} skipped: ${result.skipped
            .map((item) => item.email)
            .join(", ")}`,
          "error"
        );
      }
      setBulkDeleteOpen(false);
      clearSelection();
      router.refresh();
    });
  }

  return (
    <>
      <div className="admin-section-head">
        {!embedded && (
          <div>
            <h2 className="admin-section-head__title">All Users</h2>
            <p className="admin-section-head__desc">
              Create users and assign them to roles
            </p>
          </div>
        )}
        {embedded && (
          <p className="admin-section-head__desc">
            Platform users with assigned roles. Agents, supervisors, and quality
            analysts on audit forms are derived from these accounts.
          </p>
        )}
        <Button
          onClick={() => {
            setEditingUser(null);
            setDialogOpen(true);
          }}
        >
          <Plus size={16} />
          Add User
        </Button>
      </div>

      <BulkActionBar
        selectedCount={selectedCount}
        onClear={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        isPending={pending}
      />

      <div className="ui-table-wrap">
        <table className="ui-table ui-table--selectable">
          <thead>
            <tr>
              <th className="ui-table__check-col">
                <input
                  type="checkbox"
                  aria-label="Select all users"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  disabled={pending || users.length === 0}
                  onChange={toggleAllVisible}
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="ui-table__empty">
                  No users yet. Create your first user.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="ui-table__check-col">
                    <input
                      type="checkbox"
                      aria-label={`Select ${user.email}`}
                      checked={isSelected(user.id)}
                      disabled={pending}
                      onChange={() => toggleOne(user.id)}
                    />
                  </td>
                  <td style={{ fontWeight: 500 }}>{user.name ?? "—"}</td>
                  <td>{user.email}</td>
                  <td>
                    <Badge tone="accent">{user.role.name}</Badge>
                  </td>
                  <td>{user.dateOfJoining ?? "—"}</td>
                  <td>
                    <div className="ui-table__actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingUser(user);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="danger"
                        size="icon"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await bulkDeleteUsers([user.id]);
                            if (result.error && !result.deleted) {
                              toast(result.error, "error");
                              return;
                            }
                            toast("User deleted", "success");
                            router.refresh();
                          });
                        }}
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

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        roles={roles}
      />

      <Modal
        open={bulkDeleteOpen}
        onClose={() => !pending && setBulkDeleteOpen(false)}
        title="Delete selected users"
        description="Superadmin accounts are skipped automatically. This action cannot be undone."
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
