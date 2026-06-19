"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Plus, X } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label, Select } from "@/components/primitives/field";
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
  const isAgent = mode === "agent";

  function handleSubmit(formData: FormData) {
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
          <Field>
            <Label htmlFor="team-password">Temporary password</Label>
            <Input
              id="team-password"
              name="password"
              type="password"
              minLength={6}
              required
              disabled={pending}
            />
          </Field>
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
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  if (!user) return null;

  const userId = user.id;
  const userLabel = `${user.name} (${user.email})`;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      formData.set("userId", userId);
      const result = await resetManagedUserPassword(formData);
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }
      toast(
        "message" in result && result.message ? result.message : "Password updated",
        "success"
      );
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onOpenChange(false)}
      title="Reset password"
      description={`Set a new password for ${userLabel}.`}
    >
      <form action={handleSubmit}>
        <FormStack>
          <Field>
            <Label htmlFor="managed-password">New password</Label>
            <Input
              id="managed-password"
              name="password"
              type="password"
              minLength={6}
              required
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
}: {
  rows: ProvisioningRequestRow[];
  onReview: (id: string, action: "approve" | "reject", targetRoleSlug: string) => void;
  pendingId: string | null;
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
}: {
  title: string;
  description?: string;
  children: ReactNode;
  table?: boolean;
}) {
  return (
    <section className="team-management__panel">
      <header className="team-management__panel-head">
        <h3 className="team-management__panel-title">{title}</h3>
        {description ? (
          <p className="team-management__panel-desc">{description}</p>
        ) : null}
      </header>
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

function AgentAssignmentPanel({
  assignableAgents,
  assigneeOptions,
  agentAssignments,
  onChanged,
  pending,
}: {
  assignableAgents: AssignableAgentRow[];
  assigneeOptions: AssigneeOptionRow[];
  agentAssignments: AgentAssignmentRow[];
  onChanged: () => void;
  pending: boolean;
}) {
  const { toast } = useToast();
  const [agentId, setAgentId] = useState(assignableAgents[0]?.id ?? "");
  const [assignToId, setAssignToId] = useState(assigneeOptions[0]?.id ?? "");
  const [, startTransition] = useTransition();
  const assignmentPagination = usePaginatedRows(agentAssignments);

  function handleAssign() {
    if (!agentId || !assignToId) {
      toast("Select an agent and assignee.", "error");
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

  if (assignableAgents.length === 0) {
    return (
      <p className="platform-empty platform-empty--inline">
        Approve agent requests first — then assign them to quality analysts.
      </p>
    );
  }

  return (
    <>
      <div className="team-management__assign-form">
        <Field>
          <Label htmlFor="assign-agent">Agent</Label>
          <Select
            id="assign-agent"
            className="ui-select"
            value={agentId}
            disabled={pending}
            onChange={(e) => setAgentId(e.target.value)}
          >
            {assignableAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.email})
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="assign-to">Quality analyst</Label>
          <Select
            id="assign-to"
            className="ui-select"
            value={assignToId}
            disabled={pending || assigneeOptions.length === 0}
            onChange={(e) => setAssignToId(e.target.value)}
          >
            {assigneeOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} — {user.roleName}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          disabled={pending || !assignToId}
          onClick={handleAssign}
        >
          Assign agent
        </Button>
      </div>

      {agentAssignments.length === 0 ? (
        <p className="platform-empty platform-empty--inline">
          No active assignments yet.
        </p>
      ) : (
        <DataTablePanel
          pagination={assignmentPagination}
          renderTable={(slice) => (
            <table className="ui-table platform-report-table settings-table">
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
                    <td style={{ fontWeight: 600 }}>{row.agentName}</td>
                    <td>{row.assignToName}</td>
                    <TableRowActionsCell ariaLabel={`Assignment for ${row.agentName}`}>
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
    </>
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
        label: "Assignments",
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

      toast("message" in result ? result.message : "Updated", "success");
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
              />
            </TeamTabPanel>
          ) : null}

          {subTab === "assignments" && canAssignAgents ? (
            <TeamTabPanel
              title="Agent assignments"
              description="Link approved agents to quality analysts. Assignments refresh automatically every 10 seconds for assignees."
            >
              <AgentAssignmentPanel
                assignableAgents={assignableAgents}
                assigneeOptions={assigneeOptions}
                agentAssignments={agentAssignments}
                pending={pending}
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
