"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Plus, X } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label } from "@/components/primitives/field";
import { FormStack, Modal, ModalActions } from "@/components/primitives/modal";
import { useToast } from "@/components/primitives/toast";
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
  type ManagedUserRow,
  type ProvisioningRequestRow,
} from "@/lib/actions/user-provisioning";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

type TeamManagementProps = {
  canProvisionAgent: boolean;
  canProvisionAnalyst: boolean;
  canApproveAgent: boolean;
  canApproveAnalyst: boolean;
  canReadManaged: boolean;
  canManageManaged: boolean;
  myRequests: ProvisioningRequestRow[];
  pendingApprovals: ProvisioningRequestRow[];
  managedUsers: ManagedUserRow[];
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
        <table className="ui-table platform-report-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Requested by</th>
              <th>Submitted</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600 }}>{row.name}</td>
                <td>{row.email}</td>
                <td>{row.targetRoleLabel}</td>
                <td>{row.requestedByName}</td>
                <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="ui-table__actions">
                    <Button
                      size="sm"
                      disabled={pendingId === row.id}
                      onClick={() =>
                        onReview(row.id, "approve", row.targetRoleSlug)
                      }
                    >
                      <Check size={14} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pendingId === row.id}
                      onClick={() =>
                        onReview(row.id, "reject", row.targetRoleSlug)
                      }
                    >
                      <X size={14} />
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    />
  );
}

export function TeamManagement({
  canProvisionAgent,
  canProvisionAnalyst,
  canApproveAgent,
  canApproveAnalyst,
  canReadManaged,
  canManageManaged,
  myRequests,
  pendingApprovals,
  managedUsers,
}: TeamManagementProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [requestMode, setRequestMode] = useState<"agent" | "analyst" | null>(
    null
  );
  const [passwordUser, setPasswordUser] = useState<ManagedUserRow | null>(null);

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
    <div className="team-management">
      <div className="admin-section-head">
        <div>
          <h2 className="admin-section-head__title">Team management</h2>
          <p className="admin-section-head__desc">
            Request new team members with approval workflows. You only see audit
            data for users you onboard after approval.
          </p>
        </div>
        <div className="team-management__actions">
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
        </div>
      </div>

      {canApproveAgent && (
        <section className="team-management__section">
          <h3 className="team-management__section-title">
            Pending agent requests
          </h3>
          <p className="admin-section-head__desc">
            Supervisor agent requests awaiting Quality Manager approval.
          </p>
          <PendingApprovalsTable
            rows={pendingAgentApprovals}
            onReview={handleReview}
            pendingId={pending || pendingId ? pendingId : null}
          />
        </section>
      )}

      {canApproveAnalyst && (
        <section className="team-management__section">
          <h3 className="team-management__section-title">
            Pending analyst requests
          </h3>
          <p className="admin-section-head__desc">
            Quality Analyst requests awaiting Admin approval.
          </p>
          <PendingApprovalsTable
            rows={pendingAnalystApprovals}
            onReview={handleReview}
            pendingId={pending || pendingId ? pendingId : null}
          />
        </section>
      )}

      {canReadManaged && (
        <section className="team-management__section">
          <h3 className="team-management__section-title">Your team members</h3>
          {managedUsers.length === 0 ? (
            <p className="platform-empty platform-empty--inline">
              No approved team members yet.
            </p>
          ) : (
            <DataTablePanel
              pagination={managedPagination}
              renderTable={(slice) => (
                <table className="ui-table platform-report-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                      <th>Related audits</th>
                      {canManageManaged ? (
                        <th style={{ textAlign: "right" }}>Actions</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((user) => (
                      <tr key={user.id}>
                        <td style={{ fontWeight: 600 }}>{user.name}</td>
                        <td>{user.email}</td>
                        <td>{user.roleName}</td>
                        <td>{user.dateOfJoining ?? "—"}</td>
                        <td>{user.auditCount}</td>
                        {canManageManaged ? (
                          <td>
                            <div className="ui-table__actions">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setPasswordUser(user)}
                              >
                                <KeyRound size={14} />
                                Reset password
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            />
          )}
        </section>
      )}

      {showMyRequests && (
        <section className="team-management__section">
          <h3 className="team-management__section-title">Your requests</h3>
          {myRequests.length === 0 ? (
            <p className="platform-empty platform-empty--inline">
              No provisioning requests submitted yet.
            </p>
          ) : (
            <DataTablePanel
              pagination={myRequestsPagination}
              renderTable={(slice) => (
                <table className="ui-table platform-report-table">
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
                      <tr key={row.id}>
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
        </section>
      )}

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
