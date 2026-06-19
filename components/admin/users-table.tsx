"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { BulkActionBar } from "@/components/admin/bulk-action-bar";
import { Button } from "@/components/primitives/button";
import { Badge } from "@/components/primitives/badge";
import { Input, Select } from "@/components/primitives/field";
import { Modal } from "@/components/primitives/modal";
import {
  TableRowAction,
  TableRowActionsCell,
} from "@/components/primitives/table-row-actions";
import { useToast } from "@/components/primitives/toast";
import { UserFormDialog } from "@/components/admin/user-form-dialog";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { bulkDeleteUsers, revealUserPassword, setUserActive } from "@/lib/actions/admin";
import { formatRelativeTime } from "@/lib/format-relative-time";
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
  isActive?: boolean;
  createdAt: Date;
};

type UsersTableProps = {
  users: User[];
  roles: Role[];
  embedded?: boolean;
};

export function UsersTable({ users, roles, embedded = false }: UsersTableProps) {
  const router = useRouter();
  const { toast, toastPasswordReveal } = useToast();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter && user.roleId !== roleFilter) return false;
      if (statusFilter === "active" && user.isActive === false) return false;
      if (statusFilter === "inactive" && user.isActive !== false) return false;
      if (!q) return true;
      return (
        user.email.toLowerCase().includes(q) ||
        (user.name ?? "").toLowerCase().includes(q) ||
        user.role.name.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const pagination = usePaginatedRows(filteredUsers);

  const selectionItems = useMemo(
    () => pagination.slice.map((user) => ({ id: user.id })),
    [pagination.slice]
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
    () =>
      pagination.slice
        .filter((user) => isSelected(user.id))
        .map((user) => user.id),
    [pagination.slice, isSelected]
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
    <div className={embedded ? "settings-tab-layout" : undefined}>
      {!embedded && (
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-head__title">All Users</h2>
            <p className="admin-section-head__desc">
              Create users and assign them to roles
            </p>
          </div>
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
      )}

      <div className={embedded ? "settings-tab-layout__head" : undefined}>
      <div className="section-toolbar">
        <span className="section-toolbar__meta">
          {filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}
        </span>
        <div className="section-toolbar__search">
          <Input
            className="ui-input"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
        </div>
        {embedded ? (
          <div className="section-toolbar__actions">
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
        ) : null}
        <Select
          className="ui-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          style={{ width: 160 }}
        >
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Select>
        <Select
          className="ui-select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "" | "active" | "inactive")
          }
          aria-label="Filter by status"
          style={{ width: 140 }}
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <BulkActionBar
        selectedCount={selectedCount}
        onClear={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        isPending={pending}
      />
      </div>

      <div className={embedded ? "settings-tab-layout__body" : undefined}>
      <LoadingZone loading={pending} label="Updating users…">
      {filteredUsers.length === 0 ? (
        <EmptyState
          title={users.length === 0 ? "No users yet" : "No matching users"}
          description={
            users.length === 0
              ? "Create your first platform user to get started."
              : "Try adjusting your search or filters."
          }
          action={
            users.length === 0 ? (
              <Button
                onClick={() => {
                  setEditingUser(null);
                  setDialogOpen(true);
                }}
              >
                <Plus size={16} />
                Add User
              </Button>
            ) : undefined
          }
        />
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
                      aria-label="Select all users on this page"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected;
                      }}
                      disabled={pending || slice.length === 0}
                      onChange={toggleAllVisible}
                    />
                  </th>
                  <th className="col-name">Name</th>
                  <th className="col-email">Email</th>
                  <th className="col-role">Role</th>
                  <th className="col-status">Status</th>
                  <th className="col-date">Created</th>
                  <th className="col-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {slice.map((user) => (
                  <tr key={user.id} className="settings-table__row">
                    <td className="ui-table__check-col">
                      <input
                        type="checkbox"
                        aria-label={`Select ${user.email}`}
                        checked={isSelected(user.id)}
                        disabled={pending}
                        onChange={() => toggleOne(user.id)}
                      />
                    </td>
                    <td>
                      <div className="user-cell">
                        <span className="user-cell__avatar">
                          {(user.name ?? user.email).slice(0, 2).toUpperCase()}
                        </span>
                        <span className="user-cell__name">{user.name ?? "—"}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <Badge variant="accent">{user.role.name}</Badge>
                    </td>
                    <td>
                      <Badge
                        variant={user.isActive === false ? "default" : "success"}
                        dot
                      >
                        {user.isActive === false ? "Inactive" : "Active"}
                      </Badge>
                    </td>
                    <td
                      title={new Date(user.createdAt).toLocaleString()}
                    >
                      {formatRelativeTime(new Date(user.createdAt))}
                    </td>
                    <TableRowActionsCell ariaLabel={`Actions for ${user.email}`}>
                      <TableRowAction
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await setUserActive(
                              user.id,
                              user.isActive === false
                            );
                            if ("error" in result && result.error) {
                              toast(result.error, "error");
                              return;
                            }
                            toast(
                              user.isActive === false
                                ? "User activated."
                                : "User deactivated.",
                              "success"
                            );
                            router.refresh();
                          });
                        }}
                      >
                        <Power size={14} aria-hidden />
                        {user.isActive === false ? "Activate" : "Deactivate"}
                      </TableRowAction>
                      <TableRowAction
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await revealUserPassword(user.id);
                            if ("error" in result && result.error) {
                              toast(result.error, "error");
                              return;
                            }
                            if (result.success && result.password) {
                              toastPasswordReveal(result.email, result.password, {
                                wasReset: result.wasReset,
                              });
                            }
                          });
                        }}
                      >
                        <KeyRound size={14} aria-hidden />
                        Password
                      </TableRowAction>
                      <TableRowAction
                        onClick={() => {
                          setEditingUser(user);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil size={14} aria-hidden />
                        Edit
                      </TableRowAction>
                      <TableRowAction
                        variant="danger"
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
    </div>
  );
}
