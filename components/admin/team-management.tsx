"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Plus, X } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label, Select } from "@/components/primitives/field";
import {
  isPasswordFormValid,
  PasswordConfirmField,
  PasswordField,
} from "@/components/primitives/password-field";
import { generateClientPassword } from "@/lib/password-client";
import { FormStack, Modal, ModalActions } from "@/components/primitives/modal";
import {
  TableRowAction,
  TableRowActionsCell,
} from "@/components/primitives/table-row-actions";
import { useToast } from "@/components/primitives/toast";
import { LoadingZone } from "@/components/primitives/loading-zone";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";
import {
  approveAgentRequest,
  approveAnalystRequest,
  rejectProvisioningRequest,
  requestAgentUser,
  requestQualityAnalystUser,
  resetManagedUserPassword,
  type AgentAssignmentRow,
  type AssignableAgentRow,
  type AssigneeOptionRow,
  type ManagedUserRow,
  type ProvisioningRequestRow,
} from "@/lib/actions/user-provisioning";
import {
  assignAgentToUser,
  assignAgentsToUser,
  removeAgentFromUser,
} from "@/lib/actions/agent-assignment";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

type TeamManagementProps = {
  canProvisionAgent: boolean;
  canProvisionAnalyst: boolean;
  canApproveAgent: boolean;
  canApproveAnalyst: boolean;
  canReadManaged: boolean;
  canManageManaged: boolean;
  canAssignAgents: boolean;
  myRequests: ProvisioningRequestRow[];
  pendingApprovals: ProvisioningRequestRow[];
  managedUsers: ManagedUserRow[];
  assignableAgents: AssignableAgentRow[];
  assigneeOptions: AssigneeOptionRow[];
  agentAssignments: AgentAssignmentRow[];
  embedded?: boolean;
};

function statusClass(status: ProvisioningRequestRow["status"]) {
  if (status === "APPROVED") return "platform-tag platform-tag--success";
  if (status === "REJECTED") return "platform-tag platform-tag--danger";
  return "platform-tag platform-tag--warning";
}

function RequestFormModal({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "agent" | "analyst";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const isAgent = mode === "agent";

  useEffect(() => {
    if (open) {
      const generated = generateClientPassword(12);
      setPassword(generated);
      setConfirmPassword(generated);
    }
  }, [open, mode]);

  function handleSubmit(formData: FormData) {
    if (!isPasswordFormValid(password, confirmPassword, { minLength: 6 })) {
      toast("Enter a matching password of at least 6 characters.", "error");
      return;
    }

    formData.set("password", password);

    startTransition(async () => {
      try {
        const result = isAgent
          ? await requestAgentUser(formData)
          : await requestQualityAnalystUser(formData);

        if ("error" in result && result.error) {
          toast(result.error, "error");
          return;
        }

        toast(
          "message" in result && result.message
            ? result.message
            : "Request submitted",
          "success"
        );
        onOpenChange(false);
        router.refresh();
      } catch {
        toast(
          "Could not submit the request. Sign out and sign in again, then retry.",
          "error"
        );
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onOpenChange(false)}
      title={isAgent ? "Request new agent" : "Request quality analyst"}
      size="lg"
      description={
        isAgent
          ? "Submitted to Quality Manager for approval. The account is created only after approval."
          : "Submitted to Admin for approval. The account is created only after approval."
      }
    >
      <form action={handleSubmit}>
        <FormStack>
          <Field>
            <Label htmlFor="team-name">Display name</Label>
            <Input id="team-name" name="name" required disabled={pending} />
          </Field>
          <Field>
            <Label htmlFor="team-email">Email</Label>
            <Input
              id="team-email"
              name="email"
              type="email"
              required
              disabled={pending}
            />
          </Field>
          <PasswordField
            id="team-password"
            label="Temporary password"
            value={password}
            onChange={setPassword}
            required
            disabled={pending}
            minLength={6}
            hint="Minimum 6 characters. Use Generate for a secure temporary password."
          />
          <PasswordConfirmField
            id="team-password-confirm"
            password={password}
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={pending}
          />
          <Field>
            <Label htmlFor="team-doj">
              Date of joining{isAgent ? "" : " (optional)"}
            </Label>
            <Input
              id="team-doj"
              name="dateOfJoining"
              type="date"
              required={isAgent}
              disabled={pending}
            />
          </Field>
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
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit request"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  open,
  onOpenChange,
}: {
  user: ManagedUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast, toastPasswordReveal } = useToast();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const userId = user?.id ?? "";

  useEffect(() => {
    if (open && userId) {
      const generated = generateClientPassword(12);
      setPassword(generated);
      setConfirmPassword(generated);
    }
  }, [open, userId]);

  if (!user) return null;

  const userLabel = `${user.name} (${user.email})`;

  function handleSubmit(formData: FormData) {
    if (!isPasswordFormValid(password, confirmPassword, { minLength: 6 })) {
      toast("Enter a matching password of at least 6 characters.", "error");
      return;
    }

    formData.set("password", password);

    startTransition(async () => {
      formData.set("userId", userId);
      const result = await resetManagedUserPassword(formData);
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }
      if ("success" in result && result.success && result.password && result.email) {
        toastPasswordReveal(result.email, result.password, {
          note: "Password updated. The user must sign in with the new password.",
        });
      } else {
        toast("Password updated.", "success");
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onOpenChange(false)}
      title="Reset password"
      description={`Set a new password for ${userLabel}. They will be signed out of existing sessions.`}
    >
      <form action={handleSubmit}>
        <FormStack>
          <PasswordField
            id="managed-password"
            label="New password"
            value={password}
            onChange={setPassword}
            required
            disabled={pending}
            minLength={6}
            hint="Minimum 6 characters. Use Generate for a secure temporary password."
          />
          <PasswordConfirmField
            id="managed-password-confirm"
            password={password}
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={pending}
          />
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
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Update password"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

function PendingApprovalsTable({
  rows,
  onReview,
  pendingId,
  fillViewport = false,
}: {
  rows: ProvisioningRequestRow[];
  onReview: (id: string, action: "approve" | "reject", targetRoleSlug: string) => void;
  pendingId: string | null;
  fillViewport?: boolean;
}) {
  const pagination = usePaginatedRows(rows);

  if (rows.length === 0) {
    return (
      <p className="platform-empty platform-empty--inline">
        No pending approval requests.
      </p>
    );
  }

  return (
    <DataTablePanel
      pagination={pagination}
      fillViewport={fillViewport}
      renderTable={(slice) => (
        <table className="ui-table platform-report-table settings-table team-approvals-table">
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "14%" }} />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Requested by</th>
              <th>Submitted</th>
              <th className="col-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={row.id} className="settings-table__row">
                <td style={{ fontWeight: 600 }}>{row.name}</td>
                <td>{row.email}</td>
                <td>{row.targetRoleLabel}</td>
                <td>{row.requestedByName}</td>
                <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                <TableRowActionsCell ariaLabel={`Review request for ${row.email}`}>
                  <TableRowAction
                    disabled={pendingId === row.id}
                    onClick={() =>
                      onReview(row.id, "approve", row.targetRoleSlug)
                    }
                  >
                    <Check size={14} aria-hidden />
                    Approve
                  </TableRowAction>
                  <TableRowAction
                    variant="danger"
                    disabled={pendingId === row.id}
                    onClick={() =>
                      onReview(row.id, "reject", row.targetRoleSlug)
                    }
                  >
                    <X size={14} aria-hidden />
                    Reject
                  </TableRowAction>
                </TableRowActionsCell>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    />
  );
}

type TeamSubTabId =
  | "agent-requests"
  | "analyst-requests"
  | "assignments"
  | "members"
  | "my-requests";

function TeamTabPanel({
  title,
  description,
  children,
  table = false,
  bare = false,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  table?: boolean;
  /** Skip outer card chrome — content provides its own layout. */
  bare?: boolean;
}) {
  if (bare) {
    return (
      <div
        className={
          table
            ? "team-management__panel-body team-management__panel-body--table team-management__panel-body--bare"
            : "team-management__panel-body team-management__panel-body--bare"
        }
      >
        {children}
      </div>
    );
  }

  return (
    <section className="team-management__panel">
      {title ? (
        <header className="team-management__panel-head">
          <h3 className="team-management__panel-title">{title}</h3>
          {description ? (
            <p className="team-management__panel-desc">{description}</p>
          ) : null}
        </header>
      ) : null}
      <div
        className={
          table
            ? "team-management__panel-body team-management__panel-body--table"
            : "team-management__panel-body"
        }
      >
        {children}
      </div>
    </section>
  );
}

type AssignmentView = "single" | "multiple" | "active";

function AgentAssignmentPanel({
  assignableAgents,
  assigneeOptions,
  agentAssignments,
  onChanged,
  pending,
  fillViewport = false,
}: {
  assignableAgents: AssignableAgentRow[];
  assigneeOptions: AssigneeOptionRow[];
  agentAssignments: AgentAssignmentRow[];
  onChanged: () => void;
  pending: boolean;
  fillViewport?: boolean;
}) {
  const { toast } = useToast();
  const [view, setView] = useState<AssignmentView>("single");
  const [agentId, setAgentId] = useState(assignableAgents[0]?.id ?? "");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [assignToId, setAssignToId] = useState(assigneeOptions[0]?.id ?? "");
  const [, startTransition] = useTransition();
  const assignmentPagination = usePaginatedRows(agentAssignments);

  const alreadyAssignedToTarget = useMemo(() => {
    return new Set(
      agentAssignments
        .filter((row) => row.assignToId === assignToId)
        .map((row) => row.agentId)
    );
  }, [agentAssignments, assignToId]);

  const selectableAgents = useMemo(
    () =>
      assignableAgents.filter((agent) => !alreadyAssignedToTarget.has(agent.id)),
    [assignableAgents, alreadyAssignedToTarget]
  );

  const hiddenAssignedCount =
    assignableAgents.length - selectableAgents.length;

  useEffect(() => {
    if (assignableAgents.length === 0 && agentAssignments.length > 0) {
      setView("active");
    }
  }, [assignableAgents.length, agentAssignments.length]);

  useEffect(() => {
    if (!assignToId && assigneeOptions[0]?.id) {
      setAssignToId(assigneeOptions[0].id);
    }
  }, [assignToId, assigneeOptions]);

  useEffect(() => {
    if (agentId && alreadyAssignedToTarget.has(agentId)) {
      setAgentId(selectableAgents[0]?.id ?? "");
      return;
    }
    if (!agentId && selectableAgents[0]?.id) {
      setAgentId(selectableAgents[0].id);
    }
  }, [agentId, selectableAgents, alreadyAssignedToTarget]);

  useEffect(() => {
    setSelectedAgentIds((current) =>
      current.filter((id) => selectableAgents.some((agent) => agent.id === id))
    );
  }, [selectableAgents]);

  const allSelectableSelected =
    selectableAgents.length > 0 &&
    selectableAgents.every((agent) => selectedAgentIds.includes(agent.id));
  const someSelectableSelected =
    selectableAgents.some((agent) => selectedAgentIds.includes(agent.id)) &&
    !allSelectableSelected;

  const assigneeSelectOptions = useMemo(
    () =>
      assigneeOptions.map((user) => ({
        value: user.id,
        label: `${user.name} · ${user.roleName}`,
      })),
    [assigneeOptions]
  );

  const agentSelectOptions = useMemo(
    () =>
      selectableAgents.map((agent) => ({
        value: agent.id,
        label: agent.name,
      })),
    [selectableAgents]
  );

  function toggleAgentSelection(id: string) {
    setSelectedAgentIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    );
  }

  function toggleAllSelectable() {
    if (allSelectableSelected) {
      setSelectedAgentIds([]);
      return;
    }
    setSelectedAgentIds(selectableAgents.map((agent) => agent.id));
  }

  function handleAssign() {
    if (!assignToId) {
      toast("Select a quality analyst.", "error");
      return;
    }

    if (view === "single") {
      if (!agentId) {
        toast("Select an agent.", "error");
        return;
      }
      startTransition(async () => {
        const result = await assignAgentToUser(agentId, assignToId);
        if ("error" in result && result.error) {
          toast(result.error, "error");
          return;
        }
        toast("Agent assigned.", "success");
        onChanged();
        setView("active");
      });
      return;
    }

    if (view !== "multiple") return;

    if (selectedAgentIds.length === 0) {
      toast("Select at least one agent.", "error");
      return;
    }

    startTransition(async () => {
      const result = await assignAgentsToUser(selectedAgentIds, assignToId);
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }

      const assigned = result.assigned ?? selectedAgentIds.length;
      const skipped = result.skipped ?? 0;
      const message =
        skipped > 0
          ? `${assigned} agent${assigned === 1 ? "" : "s"} assigned. ${skipped} skipped (already assigned or unavailable).`
          : `${assigned} agent${assigned === 1 ? "" : "s"} assigned.`;

      toast(message, "success");
      setSelectedAgentIds([]);
      onChanged();
      setView("active");
    });
  }

  function handleRemove(assignment: AgentAssignmentRow) {
    startTransition(async () => {
      const result = await removeAgentFromUser(
        assignment.agentId,
        assignment.assignToId
      );
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }
      toast("Assignment removed.", "success");
      onChanged();
    });
  }

  if (assignableAgents.length === 0 && agentAssignments.length === 0) {
    return (
      <div className="team-assignments team-assignments--empty">
        <p className="platform-empty platform-empty--inline">
          Approve agent requests first — then assign them to quality analysts here.
        </p>
      </div>
    );
  }

  const assignDisabled =
    pending ||
    !assignToId ||
    assigneeOptions.length === 0 ||
    assignableAgents.length === 0 ||
    (view === "single"
      ? !agentId || selectableAgents.length === 0
      : selectedAgentIds.length === 0);

  const showAssignForm = view === "single" || view === "multiple";

  return (
    <div className="team-assignments">
      <div className="team-assignments__summary" aria-label="Assignment overview">
        <div className="team-assignments__stat">
          <span className="team-assignments__stat-value">
            {assignableAgents.length}
          </span>
          <span className="team-assignments__stat-label">Approved agents</span>
        </div>
        <div className="team-assignments__stat">
          <span className="team-assignments__stat-value">
            {assigneeOptions.length}
          </span>
          <span className="team-assignments__stat-label">Quality analysts</span>
        </div>
        <div className="team-assignments__stat">
          <span className="team-assignments__stat-value">
            {agentAssignments.length}
          </span>
          <span className="team-assignments__stat-label">Active links</span>
        </div>
      </div>

      <div className="team-assignments__shell">
        <div
          className="team-assignments__view-tabs segmented-tabs"
          role="tablist"
          aria-label="Agent assignment views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "single"}
            className={
              view === "single"
                ? "segmented-tabs__btn segmented-tabs__btn--active"
                : "segmented-tabs__btn"
            }
            disabled={pending || assignableAgents.length === 0}
            onClick={() => setView("single")}
          >
            One agent
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "multiple"}
            className={
              view === "multiple"
                ? "segmented-tabs__btn segmented-tabs__btn--active"
                : "segmented-tabs__btn"
            }
            disabled={pending || assignableAgents.length === 0}
            onClick={() => setView("multiple")}
          >
            Multiple
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "active"}
            className={
              view === "active"
                ? "segmented-tabs__btn segmented-tabs__btn--active"
                : "segmented-tabs__btn"
            }
            disabled={pending}
            onClick={() => setView("active")}
          >
            Active assignments
            <span className="segmented-tabs__count">{agentAssignments.length}</span>
          </button>
        </div>

        {showAssignForm ? (
          <section
            className="team-assignments__compose"
            aria-labelledby="team-assign-compose-title"
          >
            <p id="team-assign-compose-title" className="team-assignments__compose-lead">
              {view === "single"
                ? "Link one approved agent to a quality analyst."
                : "Select several agents and assign them to one quality analyst."}
            </p>

            <div className="team-assignments__fields">
              <Field>
                <Label htmlFor="assign-to">Quality analyst</Label>
                <Select
                  id="assign-to"
                  className="ui-select"
                  value={assignToId}
                  disabled={pending || assigneeOptions.length === 0}
                  options={assigneeSelectOptions}
                  onChange={(e) => setAssignToId(e.target.value)}
                />
              </Field>

              {view === "single" ? (
                <Field>
                  <Label htmlFor="assign-agent">Agent</Label>
                  <Select
                    id="assign-agent"
                    className="ui-select"
                    value={agentId}
                    disabled={pending || selectableAgents.length === 0}
                    options={agentSelectOptions}
                    onChange={(e) => setAgentId(e.target.value)}
                  />
                  {selectableAgents.length === 0 ? (
                    <p className="ui-hint team-assignments__field-hint">
                      All approved agents are already assigned to this analyst.
                    </p>
                  ) : hiddenAssignedCount > 0 ? (
                    <p className="ui-hint team-assignments__field-hint">
                      {hiddenAssignedCount} already linked to this analyst (hidden).
                    </p>
                  ) : null}
                </Field>
              ) : null}
            </div>

            {view === "multiple" ? (
              <Field className="team-assignments__picker">
                <div className="team-assignments__picker-head">
                  <Label htmlFor="assign-agent-all">Select agents</Label>
                  <span className="team-assignments__picker-meta">
                    {selectedAgentIds.length} of {selectableAgents.length} selected
                  </span>
                </div>
                {selectableAgents.length === 0 ? (
                  <p className="ui-hint team-assignments__field-hint">
                    All approved agents are already assigned to this analyst.
                  </p>
                ) : (
                  <div className="team-assignments__picker-list">
                    <label className="team-assignments__picker-row team-assignments__picker-row--all">
                      <input
                        id="assign-agent-all"
                        type="checkbox"
                        checked={allSelectableSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelectableSelected;
                        }}
                        disabled={pending}
                        onChange={toggleAllSelectable}
                      />
                      <span>Select all available</span>
                    </label>
                    {selectableAgents.map((agent) => (
                      <label
                        key={agent.id}
                        className="team-assignments__picker-row"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgentIds.includes(agent.id)}
                          disabled={pending}
                          onChange={() => toggleAgentSelection(agent.id)}
                        />
                        <span className="team-assignments__picker-label">
                          <span className="team-assignments__picker-name">
                            {agent.name}
                          </span>
                          <span className="team-assignments__picker-email">
                            {agent.email}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {hiddenAssignedCount > 0 ? (
                  <p className="ui-hint team-assignments__field-hint">
                    {hiddenAssignedCount} already linked to this analyst (hidden).
                  </p>
                ) : null}
              </Field>
            ) : null}

            <div className="team-assignments__compose-actions">
              <Button type="button" disabled={assignDisabled} onClick={handleAssign}>
                {view === "single"
                  ? "Assign agent"
                  : selectedAgentIds.length > 0
                    ? `Assign ${selectedAgentIds.length} agent${
                        selectedAgentIds.length === 1 ? "" : "s"
                      }`
                    : "Assign agents"}
              </Button>
            </div>
          </section>
        ) : (
          <section
            className="team-assignments__list team-assignments__list--solo"
            aria-labelledby="team-assign-list-title"
          >
            <p id="team-assign-list-title" className="team-assignments__list-lead">
              {agentAssignments.length === 0
                ? "No active agent–analyst links yet."
                : `${agentAssignments.length} active link${
                    agentAssignments.length === 1 ? "" : "s"
                  } in your scope.`}
            </p>

            {agentAssignments.length === 0 ? (
              <p className="platform-empty platform-empty--inline team-assignments__empty">
                Use One agent or Multiple to create your first assignment.
              </p>
            ) : (
              <DataTablePanel
                pagination={assignmentPagination}
                fillViewport={fillViewport}
                className="team-assignments__table-panel"
                renderTable={(slice) => (
                  <table className="ui-table platform-report-table settings-table team-assignments__table">
                    <colgroup>
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "42%" }} />
                      <col className="col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Quality analyst</th>
                        <th className="col-actions" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {slice.map((row) => (
                        <tr key={row.id} className="settings-table__row">
                          <td>
                            <span className="team-assignments__cell-primary">
                              {row.agentName}
                            </span>
                          </td>
                          <td>{row.assignToName}</td>
                          <TableRowActionsCell
                            ariaLabel={`Assignment for ${row.agentName}`}
                          >
                            <TableRowAction
                              variant="danger"
                              disabled={pending}
                              onClick={() => handleRemove(row)}
                            >
                              <X size={14} aria-hidden />
                              Remove
                            </TableRowAction>
                          </TableRowActionsCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export function TeamManagement({
  canProvisionAgent,
  canProvisionAnalyst,
  canApproveAgent,
  canApproveAnalyst,
  canReadManaged,
  canManageManaged,
  canAssignAgents,
  myRequests,
  pendingApprovals,
  managedUsers,
  assignableAgents,
  assigneeOptions,
  agentAssignments,
  embedded = false,
}: TeamManagementProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [requestMode, setRequestMode] = useState<"agent" | "analyst" | null>(
    null
  );
  const [passwordUser, setPasswordUser] = useState<ManagedUserRow | null>(null);
  const [liveAgentCount, setLiveAgentCount] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<TeamSubTabId | null>(null);

  useEffect(() => {
    if (!canReadManaged && !canApproveAgent && !canAssignAgents) return;

    let cancelled = false;

    async function pollAgents() {
      try {
        const response = await fetch("/api/assignments/my-agents", {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { agents?: unknown[] };
        if (!cancelled && Array.isArray(payload.agents)) {
          setLiveAgentCount(payload.agents.length);
        }
      } catch {
        // polling is best-effort
      }
    }

    pollAgents();
    const interval = window.setInterval(pollAgents, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [canReadManaged, canApproveAgent, canAssignAgents]);

  const myRequestsPagination = usePaginatedRows(myRequests);
  const managedPagination = usePaginatedRows(managedUsers);

  const pendingAgentApprovals = useMemo(
    () =>
      pendingApprovals.filter(
        (row) => row.targetRoleSlug === SYSTEM_ROLE_SLUGS.AGENT
      ),
    [pendingApprovals]
  );
  const pendingAnalystApprovals = useMemo(
    () =>
      pendingApprovals.filter(
        (row) => row.targetRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
      ),
    [pendingApprovals]
  );

  const showMyRequests =
    canProvisionAgent || canProvisionAnalyst || myRequests.length > 0;

  const teamTabs = useMemo(() => {
    const tabs: { id: TeamSubTabId; label: string; count?: number }[] = [];
    if (canApproveAgent) {
      tabs.push({
        id: "agent-requests",
        label: "Agent requests",
        count: pendingAgentApprovals.length,
      });
    }
    if (canApproveAnalyst) {
      tabs.push({
        id: "analyst-requests",
        label: "Analyst requests",
        count: pendingAnalystApprovals.length,
      });
    }
    if (canAssignAgents) {
      tabs.push({
        id: "assignments",
        label: "Agent assignments",
        count: agentAssignments.length,
      });
    }
    if (canReadManaged) {
      tabs.push({
        id: "members",
        label: "Team members",
        count: managedUsers.length,
      });
    }
    if (showMyRequests) {
      tabs.push({
        id: "my-requests",
        label: "Your requests",
        count: myRequests.length,
      });
    }
    return tabs;
  }, [
    canApproveAgent,
    canApproveAnalyst,
    canAssignAgents,
    canReadManaged,
    showMyRequests,
    pendingAgentApprovals.length,
    pendingAnalystApprovals.length,
    agentAssignments.length,
    managedUsers.length,
    myRequests.length,
  ]);

  useEffect(() => {
    if (teamTabs.length === 0) {
      setSubTab(null);
      return;
    }
    if (!subTab || !teamTabs.some((tab) => tab.id === subTab)) {
      setSubTab(teamTabs[0].id);
    }
  }, [teamTabs, subTab]);

  const requestActions = (
    <>
      {canProvisionAgent && (
        <Button onClick={() => setRequestMode("agent")}>
          <Plus size={16} />
          Request agent
        </Button>
      )}
      {canProvisionAnalyst && (
        <Button onClick={() => setRequestMode("analyst")}>
          <Plus size={16} />
          Request analyst
        </Button>
      )}
    </>
  );

  function handleReview(
    id: string,
    action: "approve" | "reject",
    targetRoleSlug: string
  ) {
    startTransition(async () => {
      setPendingId(id);
      const formData = new FormData();
      formData.set("id", id);

      const result =
        action === "reject"
          ? await rejectProvisioningRequest(formData)
          : targetRoleSlug === SYSTEM_ROLE_SLUGS.AGENT
            ? await approveAgentRequest(formData)
            : await approveAnalystRequest(formData);

      setPendingId(null);

      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }

      toast(
        "message" in result && result.message ? result.message : "Updated",
        "success"
      );
      router.refresh();
    });
  }

  return (
    <div
      className={
        embedded
          ? "settings-tab-layout team-management team-management--embedded"
          : "team-management"
      }
    >
      {!embedded ? (
        <>
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-head__title">Team management</h2>
              <p className="admin-section-head__desc">
                Request new team members with approval workflows. You only see audit
                data for users you onboard after approval.
              </p>
            </div>
          </div>
          {teamTabs.length > 0 ? (
            <div className="team-management__toolbar">
              <div
                className="segmented-tabs team-management__tabs"
                role="tablist"
                aria-label="Team views"
              >
                {teamTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={subTab === tab.id}
                    className={
                      subTab === tab.id
                        ? "segmented-tabs__btn segmented-tabs__btn--active"
                        : "segmented-tabs__btn"
                    }
                    onClick={() => setSubTab(tab.id)}
                  >
                    {tab.label}
                    {tab.count !== undefined ? (
                      <span className="segmented-tabs__count">{tab.count}</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="team-management__toolbar-actions">{requestActions}</div>
            </div>
          ) : (
            <div className="team-management__actions">{requestActions}</div>
          )}
        </>
      ) : (
        <div className="settings-tab-layout__head">
          <div className="team-management__toolbar">
            {teamTabs.length > 0 ? (
              <div
                className="segmented-tabs team-management__tabs"
                role="tablist"
                aria-label="Team views"
              >
                {teamTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={subTab === tab.id}
                    className={
                      subTab === tab.id
                        ? "segmented-tabs__btn segmented-tabs__btn--active"
                        : "segmented-tabs__btn"
                    }
                    onClick={() => setSubTab(tab.id)}
                  >
                    {tab.label}
                    {tab.count !== undefined ? (
                      <span className="segmented-tabs__count">{tab.count}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <span className="section-toolbar__meta">Team provisioning</span>
            )}
            <div className="team-management__toolbar-actions">{requestActions}</div>
          </div>
        </div>
      )}

      <div
        className={
          embedded
            ? "settings-tab-layout__body team-management__body"
            : "team-management__body"
        }
      >
        <LoadingZone
          loading={pending || pendingId !== null}
          label="Processing request…"
          className={embedded ? "loading-zone--fill" : undefined}
        >
          {subTab === "agent-requests" && canApproveAgent ? (
            <TeamTabPanel
              title="Pending agent requests"
              description="Review and approve agent onboarding requests."
              table
            >
              <PendingApprovalsTable
                rows={pendingAgentApprovals}
                onReview={handleReview}
                pendingId={pending || pendingId ? pendingId : null}
                fillViewport={embedded}
              />
            </TeamTabPanel>
          ) : null}

          {subTab === "analyst-requests" && canApproveAnalyst ? (
            <TeamTabPanel
              title="Pending analyst requests"
              description="Review and approve Quality Analyst onboarding requests."
              table
            >
              <PendingApprovalsTable
                rows={pendingAnalystApprovals}
                onReview={handleReview}
                pendingId={pending || pendingId ? pendingId : null}
                fillViewport={embedded}
              />
            </TeamTabPanel>
          ) : null}

          {subTab === "assignments" && canAssignAgents ? (
            <TeamTabPanel bare>
              <AgentAssignmentPanel
                assignableAgents={assignableAgents}
                assigneeOptions={assigneeOptions}
                agentAssignments={agentAssignments}
                pending={pending}
                fillViewport={embedded}
                onChanged={() => router.refresh()}
              />
            </TeamTabPanel>
          ) : null}

          {subTab === "members" && canReadManaged ? (
            <TeamTabPanel
              title="Your team members"
              description={
                liveAgentCount !== null
                  ? `${liveAgentCount} visible agent${liveAgentCount === 1 ? "" : "s"} in your scope (refreshes every 10s).`
                  : undefined
              }
              table
            >
              {managedUsers.length === 0 ? (
                <p className="platform-empty platform-empty--inline">
                  No approved team members yet.
                </p>
              ) : (
                <DataTablePanel
                  pagination={managedPagination}
                  fillViewport={embedded}
                  renderTable={(slice) => (
                    <table className="ui-table platform-report-table settings-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Joined</th>
                          <th>Related audits</th>
                          {canManageManaged ? (
                            <th className="col-actions" aria-label="Actions" />
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {slice.map((user) => (
                          <tr key={user.id} className="settings-table__row">
                            <td style={{ fontWeight: 600 }}>{user.name}</td>
                            <td>{user.email}</td>
                            <td>{user.roleName}</td>
                            <td>{user.dateOfJoining ?? "—"}</td>
                            <td>{user.auditCount}</td>
                            {canManageManaged ? (
                              <TableRowActionsCell ariaLabel={`Actions for ${user.email}`}>
                                <TableRowAction onClick={() => setPasswordUser(user)}>
                                  <KeyRound size={14} aria-hidden />
                                  Reset password
                                </TableRowAction>
                              </TableRowActionsCell>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                />
              )}
            </TeamTabPanel>
          ) : null}

          {subTab === "my-requests" && showMyRequests ? (
            <TeamTabPanel
              title="Your requests"
              description="Track provisioning requests you have submitted."
              table
            >
              {myRequests.length === 0 ? (
                <p className="platform-empty platform-empty--inline">
                  No provisioning requests submitted yet.
                </p>
              ) : (
                <DataTablePanel
                  pagination={myRequestsPagination}
                  fillViewport={embedded}
                  renderTable={(slice) => (
                    <table className="ui-table platform-report-table settings-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Reviewed by</th>
                          <th>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slice.map((row) => (
                          <tr key={row.id} className="settings-table__row">
                            <td style={{ fontWeight: 600 }}>{row.name}</td>
                            <td>{row.email}</td>
                            <td>{row.targetRoleLabel}</td>
                            <td>
                              <span className={statusClass(row.status)}>
                                {row.status}
                              </span>
                            </td>
                            <td>{row.reviewedByName ?? "—"}</td>
                            <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                />
              )}
            </TeamTabPanel>
          ) : null}
        </LoadingZone>
      </div>

      {requestMode && (
        <RequestFormModal
          open
          mode={requestMode}
          onOpenChange={(open) => !open && setRequestMode(null)}
        />
      )}

      <ResetPasswordModal
        user={passwordUser}
        open={Boolean(passwordUser)}
        onOpenChange={(open) => !open && setPasswordUser(null)}
      />
    </div>
  );
}
