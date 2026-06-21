"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { BulkActionBar } from "@/components/admin/bulk-action-bar";
import { Button } from "@/components/primitives/button";
import { Badge } from "@/components/primitives/badge";
import { ConfirmModal } from "@/components/primitives/confirm-modal";
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
import {
  FilterSidebar,
  FilterSidebarSection,
} from "@/components/filters/filter-sidebar";
import { FilterSelect } from "@/components/filters/filter-select";
import { toastUserDeleteResult } from "@/lib/admin/user-delete-result";
import { bulkDeleteUsers, revealUserPassword, setUserActive } from "@/lib/actions/admin";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useBusyAction } from "@/lib/hooks/use-busy-action";
import { useFilterSidebar } from "@/lib/hooks/use-filter-sidebar";

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
  const { busy: pending, run: runBusy } = useBusyAction();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const filterSidebar = useFilterSidebar();

  const activeSidebarFilterCount =
    (roleFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  const roleOptions = useMemo(
    () => [
      { value: "", label: "All roles" },
      ...roles.map((role) => ({ value: role.id, label: role.name })),
    ],
    [roles]
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All status" },
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
    []
  );

  const userFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (roleFilter) {
      const role = roles.find((entry) => entry.id === roleFilter);
      chips.push({
        key: "role",
        label: `Role: ${role?.name ?? roleFilter}`,
        onRemove: () => setRoleFilter(""),
      });
    }
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${statusFilter === "active" ? "Active" : "Inactive"}`,
        onRemove: () => setStatusFilter(""),
      });
    }
    return chips;
  }, [roleFilter, statusFilter, roles]);

  const clearSidebarFilters = () => {
    setRoleFilter("");
    setStatusFilter("");
  };

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

  const selectionPool = useMemo(
    () => filteredUsers.map((user) => ({ id: user.id })),
    [filteredUsers]
  );

  const visibleSelection = useMemo(
    () => pagination.slice.map((user) => ({ id: user.id })),
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

  function openCreateDialog() {
    setEditingUser(null);
    setDialogOpen(true);
  }

  function runDelete(userIds: string[], options?: { single?: boolean }) {
    if (userIds.length === 0) {
      toast("No users selected.", "error");
      return;
    }

    runBusy(async () => {
      const result = await bulkDeleteUsers(userIds);
      toastUserDeleteResult(result, toast, options);
      setBulkDeleteOpen(false);
      setDeleteTarget(null);
      clearSelection();
      router.refresh();
    });
  }

  const tableHeaderActions = (
    <Button size="sm" onClick={openCreateDialog}>
      <Plus size={16} />
      Add User
    </Button>
  );

  const emptyState =
    users.length === 0 ? (
      <>
        <p>No users yet. Create your first platform user to get started.</p>
        <Button onClick={openCreateDialog}>
          <Plus size={16} />
          Add User
        </Button>
      </>
    ) : (
      <p>No users match your search or filters. Try adjusting them.</p>
    );

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
          <Button onClick={openCreateDialog}>
            <Plus size={16} />
            Add User
          </Button>
        </div>
      )}

      <div className={embedded ? "settings-tab-layout__body" : undefined}>
        <BulkActionBar
          selectedCount={selectedCount}
          onClear={clearSelection}
          onDelete={() => setBulkDeleteOpen(true)}
          isPending={pending}
        />

        <div className={embedded ? "loading-zone--fill" : undefined}>
          <DataTablePanel
            pagination={pagination}
            fillViewport={embedded}
            summaryLabel={`${filteredUsers.length} of ${users.length} user${
              users.length === 1 ? "" : "s"
            }`}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search name or email…",
              ariaLabel: "Search users",
            }}
            filterControl={{
              activeCount: activeSidebarFilterCount,
              onOpen: filterSidebar.openFilters,
            }}
            filterChips={userFilterChips}
            onClearFilters={clearSidebarFilters}
            headerActions={embedded ? tableHeaderActions : undefined}
            emptyState={emptyState}
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
                      <td title={new Date(user.createdAt).toLocaleString()}>
                        {formatRelativeTime(new Date(user.createdAt))}
                      </td>
                      <TableRowActionsCell ariaLabel={`Actions for ${user.email}`}>
                        <TableRowAction
                          disabled={pending}
                          onClick={() => {
                            void runBusy(async () => {
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
                            void runBusy(async () => {
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
                          onClick={() => setDeleteTarget(user)}
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
        </div>
      </div>

      <FilterSidebar
        open={filterSidebar.open}
        onOpenChange={filterSidebar.onOpenChange}
        title="User filters"
        description="Narrow the user list by role or account status."
        activeCount={activeSidebarFilterCount}
        onClearAll={clearSidebarFilters}
        clearDisabled={activeSidebarFilterCount === 0}
      >
        <FilterSidebarSection label="Role">
          <FilterSelect
            value={roleFilter}
            onChange={setRoleFilter}
            options={roleOptions}
            ariaLabel="Filter by role"
          />
        </FilterSidebarSection>
        <FilterSidebarSection label="Status">
          <FilterSelect
            value={statusFilter}
            onChange={(value) =>
              setStatusFilter(value as "" | "active" | "inactive")
            }
            options={statusOptions}
            ariaLabel="Filter by status"
          />
        </FilterSidebarSection>
      </FilterSidebar>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        roles={roles}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title="Delete selected users"
        description={`Delete ${selectedCount} selected user${
          selectedCount === 1 ? "" : "s"
        }? Users with audit submissions are skipped automatically. This cannot be undone.`}
        confirmLabel={`Delete ${selectedCount}`}
        loading={pending}
        confirmDisabled={selectedCount === 0}
        onConfirm={() => runDelete(selectedIdList)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete user"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.email}? Users with audit submissions cannot be removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete user"
        loading={pending}
        onConfirm={() => deleteTarget && runDelete([deleteTarget.id], { single: true })}
      />
    </div>
  );
}
