"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Plus, Search, X } from "lucide-react";
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
  createSupervisorUser,
  createMemberUser,
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
import {
  approveAgentTransferRequest,
  rejectAgentTransferRequest,
  type PendingAgentTransferRow,
} from "@/lib/actions/agent-transfer";
import {
  bulkGrantMemberAccess,
  revokeMemberAccess,
  type GrantableTargetRow,
  type MemberOptionRow,
} from "@/lib/actions/member-access";
import type { MemberAccessGrantRecord } from "@/lib/audit/member-access";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

type MemberAccessPanelData = {
  members: MemberOptionRow[];
  grantableTargets: GrantableTargetRow[];
  grantsByMemberId: Record<string, MemberAccessGrantRecord[]>;
};

type TeamManagementProps = {
  canProvisionAgent: boolean;
  canProvisionAnalyst: boolean;
  canProvisionSupervisor: boolean;
  canProvisionMember: boolean;
  canManageMemberAccess: boolean;
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
  pendingTransferRequests: PendingAgentTransferRow[];
  memberAccess: MemberAccessPanelData;
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
  createsAgentImmediately = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "agent" | "analyst";
  /** QM / Superadmin: agent accounts are created on submit (no pending approval). */
  createsAgentImmediately?: boolean;
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

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

  const agentTitle = createsAgentImmediately
    ? "Create agent account"
    : "Request new agent";
  const agentDescription = createsAgentImmediately
    ? "Creates an active agent under your team immediately. Share the temporary password securely."
    : "Submitted to Quality Manager for approval. The account is created only after approval.";

  return (
    <Modal
      open={open}
      onClose={() => !pending && onOpenChange(false)}
      title={isAgent ? agentTitle : "Request quality analyst"}
      size="lg"
      description={
        isAgent
          ? agentDescription
          : "Submitted to Admin for approval. The account is created only after approval."
      }
    >
      <form onSubmit={handleSubmit}>
        <FormStack>
          <Field>
            <Label htmlFor="team-name">User name</Label>
            <Input
              id="team-name"
              name="name"
              required
              disabled={pending}
              placeholder="Person’s display name"
            />
          </Field>
          <Field>
            <Label htmlFor="team-team-name">Team name</Label>
            <Input
              id="team-team-name"
              name="teamName"
              disabled={pending}
              placeholder="Optional — used for team reporting"
            />
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

function CreateSupervisorModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast, toastPasswordReveal } = useToast();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (open) {
      const generated = generateClientPassword(12);
      setPassword(generated);
      setConfirmPassword(generated);
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (!isPasswordFormValid(password, confirmPassword, { minLength: 6 })) {
      toast("Enter a matching password of at least 6 characters.", "error");
      return;
    }

    formData.set("password", password);

    startTransition(async () => {
      const result = await createSupervisorUser(formData);
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }

      if ("success" in result && result.success && result.password && result.email) {
        toastPasswordReveal(result.email, result.password, {
          note: "Supervisor account created. Share this password securely with the user.",
        });
      } else {
        toast("Supervisor created.", "success");
      }

      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onOpenChange(false)}
      title="Create supervisor"
      size="lg"
      description="Create a Supervisor account with a user name and the team name used for reporting and team scope."
    >
      <form onSubmit={handleSubmit}>
        <FormStack>
          <Field>
            <Label htmlFor="supervisor-name">User name</Label>
            <Input
              id="supervisor-name"
              name="name"
              required
              disabled={pending}
              placeholder="Person’s display name"
            />
          </Field>
          <Field>
            <Label htmlFor="supervisor-team-name">
              Team name <span aria-hidden>*</span>
            </Label>
            <Input
              id="supervisor-team-name"
              name="teamName"
              required
              disabled={pending}
              placeholder="Used for team reporting and filters"
            />
          </Field>
          <Field>
            <Label htmlFor="supervisor-email">Email</Label>
            <Input
              id="supervisor-email"
              name="email"
              type="email"
              required
              disabled={pending}
            />
          </Field>
          <PasswordField
            id="supervisor-password"
            label="Temporary password"
            value={password}
            onChange={setPassword}
            required
            disabled={pending}
            minLength={6}
            hint="Minimum 6 characters. Use Generate for a secure temporary password."
          />
          <PasswordConfirmField
            id="supervisor-password-confirm"
            password={password}
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={pending}
          />
          <Field>
            <Label htmlFor="supervisor-doj">Date of joining (optional)</Label>
            <Input
              id="supervisor-doj"
              name="dateOfJoining"
              type="date"
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
            {pending ? "Creating…" : "Create supervisor"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

function CreateMemberModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast, toastPasswordReveal } = useToast();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (open) {
      const generated = generateClientPassword(12);
      setPassword(generated);
      setConfirmPassword(generated);
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (!isPasswordFormValid(password, confirmPassword, { minLength: 6 })) {
      toast("Enter a matching password of at least 6 characters.", "error");
      return;
    }

    formData.set("password", password);

    startTransition(async () => {
      const result = await createMemberUser(formData);
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }

      if ("success" in result && result.success && result.password && result.email) {
        toastPasswordReveal(result.email, result.password, {
          note: "Member account created. Grant Agent or QA access from Member access, then share this password securely.",
        });
      } else {
        toast("Member created.", "success");
      }

      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onOpenChange(false)}
      title="Create member"
      size="lg"
      description="Create a Member account. Visibility stays empty until you grant specific Agent or Quality Analyst access."
    >
      <form onSubmit={handleSubmit}>
        <FormStack>
          <Field>
            <Label htmlFor="member-name">User name</Label>
            <Input
              id="member-name"
              name="name"
              required
              disabled={pending}
              placeholder="Person’s display name"
            />
          </Field>
          <Field>
            <Label htmlFor="member-team-name">Team name</Label>
            <Input
              id="member-team-name"
              name="teamName"
              disabled={pending}
              placeholder="Optional — used for team reporting"
            />
          </Field>
          <Field>
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              name="email"
              type="email"
              required
              disabled={pending}
            />
          </Field>
          <PasswordField
            id="member-password"
            label="Temporary password"
            value={password}
            onChange={setPassword}
            required
            disabled={pending}
            minLength={6}
            hint="Minimum 6 characters. Use Generate for a secure temporary password."
          />
          <PasswordConfirmField
            id="member-password-confirm"
            password={password}
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={pending}
          />
          <Field>
            <Label htmlFor="member-doj">Date of joining (optional)</Label>
            <Input
              id="member-doj"
              name="dateOfJoining"
              type="date"
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
            {pending ? "Creating…" : "Create member"}
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

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
      <form onSubmit={handleSubmit}>
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
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.targetRoleLabel.toLowerCase().includes(q) ||
        row.requestedByName.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const pagination = usePaginatedRows(filteredRows);

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
      summaryLabel={`${filteredRows.length} of ${rows.length} request${
        rows.length === 1 ? "" : "s"
      }`}
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search requests…",
        ariaLabel: "Search pending requests",
      }}
      emptyState={<p>No requests match your search.</p>}
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

function PendingTransferApprovalsTable({
  rows,
  onReview,
  pendingId,
  fillViewport = false,
}: {
  rows: PendingAgentTransferRow[];
  onReview: (id: string, action: "approve" | "reject") => void;
  pendingId: string | null;
  fillViewport?: boolean;
}) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.agentName.toLowerCase().includes(q) ||
        row.agentEmail.toLowerCase().includes(q) ||
        row.fromSupervisorName.toLowerCase().includes(q) ||
        row.toSupervisorName.toLowerCase().includes(q) ||
        row.requestedByName.toLowerCase().includes(q) ||
        (row.note ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const pagination = usePaginatedRows(filteredRows);

  if (rows.length === 0) {
    return (
      <p className="platform-empty platform-empty--inline">
        No pending agent transfer requests.
      </p>
    );
  }

  return (
    <DataTablePanel
      pagination={pagination}
      fillViewport={fillViewport}
      summaryLabel={`${filteredRows.length} of ${rows.length} transfer request${
        rows.length === 1 ? "" : "s"
      }`}
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search transfer requests…",
        ariaLabel: "Search transfer requests",
      }}
      emptyState={<p>No transfer requests match your search.</p>}
      renderTable={(slice) => (
        <table className="ui-table platform-report-table settings-table team-approvals-table">
          <colgroup>
            <col style={{ width: "14%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Email</th>
              <th>From</th>
              <th>To</th>
              <th>Requested by</th>
              <th>Audits</th>
              <th>Submitted</th>
              <th className="col-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={row.id} className="settings-table__row">
                <td style={{ fontWeight: 600 }}>{row.agentName}</td>
                <td>{row.agentEmail}</td>
                <td>{row.fromSupervisorName}</td>
                <td>{row.toSupervisorName}</td>
                <td>{row.requestedByName}</td>
                <td>{row.pendingAuditCount}</td>
                <td>{new Date(row.requestedAt).toLocaleDateString()}</td>
                <TableRowActionsCell ariaLabel={`Review transfer for ${row.agentName}`}>
                  <TableRowAction
                    disabled={pendingId === row.id}
                    onClick={() => onReview(row.id, "approve")}
                  >
                    <Check size={14} aria-hidden />
                    Approve
                  </TableRowAction>
                  <TableRowAction
                    variant="danger"
                    disabled={pendingId === row.id}
                    onClick={() => onReview(row.id, "reject")}
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
  | "transfer-requests"
  | "analyst-requests"
  | "assignments"
  | "member-access"
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
  const [agentSearch, setAgentSearch] = useState("");
  const [assignToId, setAssignToId] = useState(assigneeOptions[0]?.id ?? "");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [, startTransition] = useTransition();

  const filteredAssignments = useMemo(() => {
    const q = assignmentSearch.trim().toLowerCase();
    if (!q) return agentAssignments;
    return agentAssignments.filter(
      (row) =>
        row.agentName.toLowerCase().includes(q) ||
        row.assignToName.toLowerCase().includes(q)
    );
  }, [agentAssignments, assignmentSearch]);

  const assignmentPagination = usePaginatedRows(filteredAssignments);

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

  useEffect(() => {
    setAgentSearch("");
  }, [view, assignToId]);

  const filteredSelectableAgents = useMemo(() => {
    const query = agentSearch.trim().toLowerCase();
    if (!query) return selectableAgents;
    return selectableAgents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.email.toLowerCase().includes(query)
    );
  }, [agentSearch, selectableAgents]);

  const allFilteredSelected =
    filteredSelectableAgents.length > 0 &&
    filteredSelectableAgents.every((agent) =>
      selectedAgentIds.includes(agent.id)
    );
  const someFilteredSelected =
    filteredSelectableAgents.some((agent) =>
      selectedAgentIds.includes(agent.id)
    ) && !allFilteredSelected;

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
    const agents = agentSearch.trim()
      ? filteredSelectableAgents
      : selectableAgents;
    const allSelected = agents.every((agent) =>
      selectedAgentIds.includes(agent.id)
    );

    if (allSelected) {
      setSelectedAgentIds((current) =>
        current.filter((id) => !agents.some((agent) => agent.id === id))
      );
      return;
    }

    setSelectedAgentIds((current) => {
      const next = new Set(current);
      for (const agent of agents) {
        next.add(agent.id);
      }
      return [...next];
    });
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
        try {
          const result = await assignAgentToUser(agentId, assignToId);
          if ("error" in result && result.error) {
            toast(result.error, "error");
            return;
          }
          toast("Agent assigned.", "success");
          onChanged();
          setView("active");
        } catch {
          toast(
            "Could not assign the agent. Sign out and sign in again, then retry.",
            "error"
          );
        }
      });
      return;
    }

    if (view !== "multiple") return;

    if (selectedAgentIds.length === 0) {
      toast("Select at least one agent.", "error");
      return;
    }

    startTransition(async () => {
      try {
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
      } catch {
        toast(
          "Could not assign agents. Sign out and sign in again, then retry.",
          "error"
        );
      }
    });
  }

  function handleRemove(assignment: AgentAssignmentRow) {
    startTransition(async () => {
      try {
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
      } catch {
        toast(
          "Could not remove the assignment. Sign out and sign in again, then retry.",
          "error"
        );
      }
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
                  <Label htmlFor="assign-agent-search">Select agents</Label>
                  <span className="team-assignments__picker-meta">
                    {selectedAgentIds.length} selected
                    {agentSearch.trim()
                      ? ` · ${filteredSelectableAgents.length} shown`
                      : ` · ${selectableAgents.length} available`}
                  </span>
                </div>
                {selectableAgents.length === 0 ? (
                  <p className="ui-hint team-assignments__field-hint">
                    All approved agents are already assigned to this analyst.
                  </p>
                ) : (
                  <>
                    <div className="team-assignments__picker-search platform-settings__search-wrap">
                      <Search
                        size={16}
                        className="platform-settings__search-icon"
                        aria-hidden
                      />
                      <input
                        id="assign-agent-search"
                        type="search"
                        className="platform-settings__search"
                        placeholder="Search by name or email…"
                        value={agentSearch}
                        disabled={pending}
                        onChange={(event) => setAgentSearch(event.target.value)}
                        aria-label="Search agents"
                      />
                      {agentSearch.trim() ? (
                        <button
                          type="button"
                          className="team-assignments__picker-search-clear"
                          aria-label="Clear search"
                          disabled={pending}
                          onClick={() => setAgentSearch("")}
                        >
                          <X size={14} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                    <div className="team-assignments__picker-list">
                      {filteredSelectableAgents.length === 0 ? (
                        <p className="team-assignments__picker-empty">
                          No agents match &ldquo;{agentSearch.trim()}&rdquo;.
                        </p>
                      ) : (
                        <>
                          <label className="team-assignments__picker-row team-assignments__picker-row--all">
                            <input
                              id="assign-agent-all"
                              type="checkbox"
                              checked={allFilteredSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someFilteredSelected;
                              }}
                              disabled={pending}
                              onChange={toggleAllSelectable}
                            />
                            <span>
                              {agentSearch.trim()
                                ? "Select all shown"
                                : "Select all available"}
                            </span>
                          </label>
                          {filteredSelectableAgents.map((agent) => (
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
                        </>
                      )}
                    </div>
                  </>
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
                summaryLabel={`${filteredAssignments.length} of ${
                  agentAssignments.length
                } link${agentAssignments.length === 1 ? "" : "s"}`}
                search={{
                  value: assignmentSearch,
                  onChange: setAssignmentSearch,
                  placeholder: "Search assignments…",
                  ariaLabel: "Search active assignments",
                }}
                emptyState={<p>No assignments match your search.</p>}
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

type MemberAccessRoleFilter = "all" | "agent" | "qa";

function MemberAccessPanel({
  members,
  grantableTargets,
  grantsByMemberId,
  onChanged,
  pending,
  fillViewport = false,
}: {
  members: MemberOptionRow[];
  grantableTargets: GrantableTargetRow[];
  grantsByMemberId: Record<string, MemberAccessGrantRecord[]>;
  onChanged: () => void;
  pending: boolean;
  fillViewport?: boolean;
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<MemberAccessRoleFilter>("all");
  const [targetSearch, setTargetSearch] = useState("");
  const [grantRoleFilter, setGrantRoleFilter] =
    useState<MemberAccessRoleFilter>("all");
  const [grantSearch, setGrantSearch] = useState("");

  useEffect(() => {
    if (!memberId && members[0]?.id) {
      setMemberId(members[0].id);
    }
    if (memberId && !members.some((m) => m.id === memberId)) {
      setMemberId(members[0]?.id ?? "");
    }
  }, [members, memberId]);

  useEffect(() => {
    setSelectedTargetIds([]);
    setTargetSearch("");
    setRoleFilter("all");
    setGrantRoleFilter("all");
    setGrantSearch("");
  }, [memberId]);

  useEffect(() => {
    setTargetSearch("");
  }, [roleFilter]);

  useEffect(() => {
    setGrantSearch("");
  }, [grantRoleFilter]);

  const activeGrants = useMemo(
    () => (memberId ? grantsByMemberId[memberId] ?? [] : []),
    [grantsByMemberId, memberId]
  );

  const grantedTargetIds = useMemo(
    () => new Set(activeGrants.map((g) => g.targetUserId)),
    [activeGrants]
  );

  const selectableTargets = useMemo(() => {
    return grantableTargets.filter((t) => {
      if (grantedTargetIds.has(t.id)) return false;
      if (roleFilter === "agent") {
        return t.roleSlug === SYSTEM_ROLE_SLUGS.AGENT;
      }
      if (roleFilter === "qa") {
        return t.roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST;
      }
      return true;
    });
  }, [grantableTargets, grantedTargetIds, roleFilter]);

  const filteredSelectableTargets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return selectableTargets;
    return selectableTargets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.roleName.toLowerCase().includes(q)
    );
  }, [selectableTargets, targetSearch]);

  const filteredGrants = useMemo(() => {
    return activeGrants.filter((g) => {
      if (grantRoleFilter === "agent") {
        if (g.targetRoleSlug !== SYSTEM_ROLE_SLUGS.AGENT) return false;
      } else if (grantRoleFilter === "qa") {
        if (g.targetRoleSlug !== SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) return false;
      }
      const q = grantSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        g.targetName.toLowerCase().includes(q) ||
        g.targetEmail.toLowerCase().includes(q) ||
        g.grantedByName.toLowerCase().includes(q)
      );
    });
  }, [activeGrants, grantRoleFilter, grantSearch]);

  const selectedMember = members.find((m) => m.id === memberId) ?? null;
  const grantedAgentCount = activeGrants.filter(
    (g) => g.targetRoleSlug === SYSTEM_ROLE_SLUGS.AGENT
  ).length;
  const grantedQaCount = activeGrants.filter(
    (g) => g.targetRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
  ).length;

  const memberSelectOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: `${m.name} · ${m.email}`,
      })),
    [members]
  );

  function toggleTarget(id: string) {
    setSelectedTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const allFilteredSelected =
    filteredSelectableTargets.length > 0 &&
    filteredSelectableTargets.every((t) => selectedTargetIds.includes(t.id));
  const someFilteredSelected =
    !allFilteredSelected &&
    filteredSelectableTargets.some((t) => selectedTargetIds.includes(t.id));

  function toggleAllSelectable() {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredSelectableTargets.map((t) => t.id));
      setSelectedTargetIds((prev) => prev.filter((id) => !filteredIds.has(id)));
      return;
    }
    setSelectedTargetIds((prev) => [
      ...new Set([...prev, ...filteredSelectableTargets.map((t) => t.id)]),
    ]);
  }

  function handleGrant() {
    if (!memberId || selectedTargetIds.length === 0) return;
    startTransition(async () => {
      const result = await bulkGrantMemberAccess(memberId, selectedTargetIds);
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }
      toast(
        "message" in result && result.message ? result.message : "Access granted.",
        "success"
      );
      setSelectedTargetIds([]);
      onChanged();
    });
  }

  function handleRevoke(grantId: string) {
    startTransition(async () => {
      const result = await revokeMemberAccess(grantId);
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }
      toast(
        "message" in result && result.message ? result.message : "Access revoked.",
        "success"
      );
      onChanged();
    });
  }

  function roleBadge(slug: string) {
    if (slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
      return <span className="member-access__badge member-access__badge--qa">QA</span>;
    }
    return (
      <span className="member-access__badge member-access__badge--agent">Agent</span>
    );
  }

  function roleFilterTabs(
    value: MemberAccessRoleFilter,
    onChange: (next: MemberAccessRoleFilter) => void,
    counts: { all: number; agent: number; qa: number },
    idPrefix: string
  ) {
    const tabs: { id: MemberAccessRoleFilter; label: string; count: number }[] = [
      { id: "all", label: "All", count: counts.all },
      { id: "agent", label: "Agents", count: counts.agent },
      { id: "qa", label: "QA", count: counts.qa },
    ];
    return (
      <div
        className="member-access__role-tabs segmented-tabs"
        role="tablist"
        aria-label="Filter by role"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`${idPrefix}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={value === tab.id}
            className={
              value === tab.id
                ? "segmented-tabs__btn segmented-tabs__btn--active"
                : "segmented-tabs__btn"
            }
            disabled={pending}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            <span className="segmented-tabs__count">{tab.count}</span>
          </button>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div
        className={
          fillViewport
            ? "member-access member-access--fill member-access--empty"
            : "member-access member-access--empty"
        }
      >
        <div className="member-access__empty-card">
          <h3 className="member-access__empty-title">No members yet</h3>
          <p className="member-access__empty-desc">
            Use <strong>Create member</strong> above, then come back here to grant
            Agent or QA visibility.
          </p>
        </div>
      </div>
    );
  }

  const availableCounts = {
    all: grantableTargets.filter((t) => !grantedTargetIds.has(t.id)).length,
    agent: grantableTargets.filter(
      (t) =>
        !grantedTargetIds.has(t.id) && t.roleSlug === SYSTEM_ROLE_SLUGS.AGENT
    ).length,
    qa: grantableTargets.filter(
      (t) =>
        !grantedTargetIds.has(t.id) &&
        t.roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
    ).length,
  };

  return (
    <div
      className={
        fillViewport ? "member-access member-access--fill" : "member-access"
      }
    >
      <div className="member-access__bar">
        <Field className="member-access__member-field">
          <Label htmlFor="member-access-member">Member</Label>
          <Select
            id="member-access-member"
            className="ui-select"
            value={memberId}
            disabled={pending}
            options={memberSelectOptions}
            onChange={(e) => setMemberId(e.target.value)}
          />
        </Field>
        <div className="member-access__bar-meta" aria-live="polite">
          {selectedMember ? (
            <>
              <span className="member-access__chip">
                {grantedAgentCount} Agent{grantedAgentCount === 1 ? "" : "s"}
              </span>
              <span className="member-access__chip">
                {grantedQaCount} QA{grantedQaCount === 1 ? "" : "s"}
              </span>
              <span className="member-access__chip member-access__chip--accent">
                {selectedTargetIds.length} selected
              </span>
            </>
          ) : (
            <span className="member-access__bar-hint">Select a member</span>
          )}
        </div>
        <Button
          type="button"
          className="member-access__grant-btn"
          disabled={pending || !memberId || selectedTargetIds.length === 0}
          onClick={handleGrant}
        >
          {selectedTargetIds.length > 0
            ? `Grant ${selectedTargetIds.length}`
            : "Grant access"}
        </Button>
      </div>

      <div className="member-access__grid">
        <section
          className="member-access__panel"
          aria-labelledby="member-access-grant-title"
        >
          <div className="member-access__panel-head">
            <h4 id="member-access-grant-title" className="member-access__panel-title">
              1. Select people to grant
            </h4>
            <span className="member-access__panel-meta">
              {selectableTargets.length} available
            </span>
          </div>

          <div className="member-access__controls">
            {roleFilterTabs(
              roleFilter,
              setRoleFilter,
              availableCounts,
              "member-grant-filter"
            )}
            <div className="member-access__search platform-settings__search-wrap">
              <Search
                size={16}
                className="platform-settings__search-icon"
                aria-hidden
              />
              <input
                id="member-access-target-search"
                type="search"
                className="platform-settings__search"
                placeholder={
                  roleFilter === "agent"
                    ? "Search agents…"
                    : roleFilter === "qa"
                      ? "Search quality analysts…"
                      : "Search by name or email…"
                }
                value={targetSearch}
                disabled={pending || !memberId}
                onChange={(event) => setTargetSearch(event.target.value)}
                aria-label="Search grantable users"
              />
              {targetSearch.trim() ? (
                <button
                  type="button"
                  className="member-access__search-clear"
                  aria-label="Clear search"
                  disabled={pending}
                  onClick={() => setTargetSearch("")}
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          <div className="member-access__scroll">
            {selectableTargets.length === 0 ? (
              <div className="member-access__panel-empty">
                {roleFilter === "all"
                  ? "Everyone available is already granted to this member."
                  : roleFilter === "agent"
                    ? "No more Agents available."
                    : "No more Quality Analysts available."}
              </div>
            ) : filteredSelectableTargets.length === 0 ? (
              <div className="member-access__panel-empty">
                No{" "}
                {roleFilter === "qa"
                  ? "QAs"
                  : roleFilter === "agent"
                    ? "agents"
                    : "users"}{" "}
                match your search.
              </div>
            ) : (
              <div className="member-access__list">
                <label className="member-access__row member-access__row--all">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected;
                    }}
                    disabled={pending || !memberId}
                    onChange={toggleAllSelectable}
                  />
                  <span>Select all shown</span>
                </label>
                {filteredSelectableTargets.map((target) => {
                  const selected = selectedTargetIds.includes(target.id);
                  return (
                    <label
                      key={target.id}
                      className={
                        selected
                          ? "member-access__row member-access__row--selected"
                          : "member-access__row"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={pending || !memberId}
                        onChange={() => toggleTarget(target.id)}
                      />
                      <span className="member-access__row-body">
                        <span className="member-access__row-top">
                          <span className="member-access__row-name">
                            {target.name}
                          </span>
                          {roleBadge(target.roleSlug)}
                        </span>
                        <span className="member-access__row-email">
                          {target.email}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section
          className="member-access__panel member-access__panel--grants"
          aria-labelledby="member-access-grants-title"
        >
          <div className="member-access__panel-head">
            <h4
              id="member-access-grants-title"
              className="member-access__panel-title"
            >
              2. Active access
            </h4>
            <span className="member-access__panel-meta">
              {activeGrants.length} grant{activeGrants.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="member-access__controls">
            {roleFilterTabs(
              grantRoleFilter,
              setGrantRoleFilter,
              {
                all: activeGrants.length,
                agent: grantedAgentCount,
                qa: grantedQaCount,
              },
              "member-active-filter"
            )}
            <div className="member-access__search platform-settings__search-wrap">
              <Search
                size={16}
                className="platform-settings__search-icon"
                aria-hidden
              />
              <input
                type="search"
                className="platform-settings__search"
                placeholder="Search grants…"
                value={grantSearch}
                disabled={pending || activeGrants.length === 0}
                onChange={(event) => setGrantSearch(event.target.value)}
                aria-label="Search active grants"
              />
              {grantSearch.trim() ? (
                <button
                  type="button"
                  className="member-access__search-clear"
                  aria-label="Clear search"
                  disabled={pending}
                  onClick={() => setGrantSearch("")}
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          <div className="member-access__scroll">
            {activeGrants.length === 0 ? (
              <div className="member-access__panel-empty">
                No access yet. Select people on the left, then press{" "}
                <strong>Grant</strong> above.
              </div>
            ) : filteredGrants.length === 0 ? (
              <div className="member-access__panel-empty">
                No grants match this filter.
              </div>
            ) : (
              <ul className="member-access__grant-list">
                {filteredGrants.map((row) => (
                  <li key={row.id} className="member-access__grant">
                    <div className="member-access__grant-main">
                      <div className="member-access__row-top">
                        <span className="member-access__row-name">
                          {row.targetName}
                        </span>
                        {roleBadge(row.targetRoleSlug)}
                      </div>
                      <span className="member-access__row-email">
                        {row.targetEmail}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="member-access__revoke"
                      disabled={pending}
                      onClick={() => handleRevoke(row.id)}
                      aria-label={`Revoke access for ${row.targetName}`}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function TeamManagement({
  canProvisionAgent,
  canProvisionAnalyst,
  canProvisionSupervisor,
  canProvisionMember,
  canManageMemberAccess,
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
  pendingTransferRequests,
  memberAccess,
  embedded = false,
}: TeamManagementProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [requestMode, setRequestMode] = useState<"agent" | "analyst" | null>(
    null
  );
  const [supervisorModalOpen, setSupervisorModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
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

  const [membersSearch, setMembersSearch] = useState("");
  const [myRequestsSearch, setMyRequestsSearch] = useState("");

  const filteredManagedUsers = useMemo(() => {
    const q = membersSearch.trim().toLowerCase();
    if (!q) return managedUsers;
    return managedUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.roleName.toLowerCase().includes(q) ||
        (user.teamName ?? "").toLowerCase().includes(q)
    );
  }, [managedUsers, membersSearch]);

  const filteredMyRequests = useMemo(() => {
    const q = myRequestsSearch.trim().toLowerCase();
    if (!q) return myRequests;
    return myRequests.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.targetRoleLabel.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        (row.reviewedByName ?? "").toLowerCase().includes(q)
    );
  }, [myRequests, myRequestsSearch]);

  const myRequestsPagination = usePaginatedRows(filteredMyRequests);
  const managedPagination = usePaginatedRows(filteredManagedUsers);

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
    // Member access first — primary QM/Superadmin workflow.
    if (canManageMemberAccess) {
      const grantCount = Object.values(memberAccess.grantsByMemberId).reduce(
        (sum, grants) => sum + grants.length,
        0
      );
      tabs.push({
        id: "member-access",
        label: "Member access",
        count: grantCount,
      });
    }
    if (canApproveAgent) {
      tabs.push({
        id: "agent-requests",
        label: "Agent requests",
        count: pendingAgentApprovals.length,
      });
      tabs.push({
        id: "transfer-requests",
        label: "Transfer requests",
        count: pendingTransferRequests.length,
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
    canManageMemberAccess,
    canReadManaged,
    showMyRequests,
    pendingAgentApprovals.length,
    pendingTransferRequests.length,
    pendingAnalystApprovals.length,
    agentAssignments.length,
    memberAccess.grantsByMemberId,
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
      {canProvisionSupervisor && (
        <Button onClick={() => setSupervisorModalOpen(true)}>
          <Plus size={16} />
          Create supervisor
        </Button>
      )}
      {canProvisionMember && (
        <Button onClick={() => setMemberModalOpen(true)}>
          <Plus size={16} />
          Create member
        </Button>
      )}
      {canProvisionAgent && (
        <Button onClick={() => setRequestMode("agent")}>
          <Plus size={16} />
          {canApproveAgent ? "Create agent" : "Request agent"}
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

  function handleTransferReview(id: string, action: "approve" | "reject") {
    startTransition(async () => {
      setPendingId(id);
      const result =
        action === "reject"
          ? await rejectAgentTransferRequest({ transferId: id })
          : await approveAgentTransferRequest({ transferId: id });

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

          {subTab === "transfer-requests" && canApproveAgent ? (
            <TeamTabPanel
              title="Pending agent transfer requests"
              description="Review supervisor-initiated transfers before an agent moves to a new supervisor."
              table
            >
              <PendingTransferApprovalsTable
                rows={pendingTransferRequests}
                onReview={handleTransferReview}
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

          {subTab === "member-access" && canManageMemberAccess ? (
            <TeamTabPanel bare>
              <MemberAccessPanel
                members={memberAccess.members}
                grantableTargets={memberAccess.grantableTargets}
                grantsByMemberId={memberAccess.grantsByMemberId}
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
                  summaryLabel={`${filteredManagedUsers.length} of ${
                    managedUsers.length
                  } member${managedUsers.length === 1 ? "" : "s"}`}
                  search={{
                    value: membersSearch,
                    onChange: setMembersSearch,
                    placeholder: "Search team members…",
                    ariaLabel: "Search team members",
                  }}
                  emptyState={<p>No team members match your search.</p>}
                  renderTable={(slice) => (
                    <table className="ui-table platform-report-table settings-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Team</th>
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
                            <td>{user.teamName ?? "—"}</td>
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
                  summaryLabel={`${filteredMyRequests.length} of ${
                    myRequests.length
                  } request${myRequests.length === 1 ? "" : "s"}`}
                  search={{
                    value: myRequestsSearch,
                    onChange: setMyRequestsSearch,
                    placeholder: "Search your requests…",
                    ariaLabel: "Search your requests",
                  }}
                  emptyState={<p>No requests match your search.</p>}
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
          createsAgentImmediately={
            requestMode === "agent" && canApproveAgent
          }
          onOpenChange={(open) => !open && setRequestMode(null)}
        />
      )}

      <CreateSupervisorModal
        open={supervisorModalOpen}
        onOpenChange={setSupervisorModalOpen}
      />

      <CreateMemberModal
        open={memberModalOpen}
        onOpenChange={setMemberModalOpen}
      />

      <ResetPasswordModal
        user={passwordUser}
        open={Boolean(passwordUser)}
        onOpenChange={(open) => !open && setPasswordUser(null)}
      />
    </div>
  );
}
