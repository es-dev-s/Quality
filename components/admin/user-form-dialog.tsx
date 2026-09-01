"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label, Select } from "@/components/primitives/field";
import { FormStack, Modal, ModalActions } from "@/components/primitives/modal";
import {
  isPasswordFormValid,
  PasswordConfirmField,
  PasswordField,
} from "@/components/primitives/password-field";
import { useToast } from "@/components/primitives/toast";
import { useBusyAction } from "@/lib/hooks/use-busy-action";
import { createUser, updateUser } from "@/lib/actions/admin";
import { generateClientPassword } from "@/lib/password-client";
import { isLegacySystemRole, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { isSupervisorRoleSlug } from "@/lib/audit/supervisor-tier";

type Role = {
  id: string;
  name: string;
  slug: string;
  isSystem?: boolean;
  _count?: { scopes: number };
};

function roleOptionLabel(role: Role) {
  const legacy = isLegacySystemRole(role.slug) ? " (legacy)" : "";
  const suffix = role.isSystem ? " (system)" : "";
  const scopeHint =
    !role.isSystem && role._count?.scopes === 0 ? " — no permissions" : "";
  return `${role.name}${legacy}${suffix}${scopeHint}`;
}

type User = {
  id: string;
  name: string | null;
  email: string;
  roleId: string;
  dateOfJoining?: string | null;
  teamName?: string | null;
};

type UserFormSnapshot = {
  name: string;
  email: string;
  teamName: string;
  roleId: string;
  dateOfJoining: string;
};

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  roles: Role[];
};

function snapshotFromUser(user: User | null, fallbackRoleId: string): UserFormSnapshot {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    teamName: user?.teamName ?? "",
    roleId: user?.roleId ?? fallbackRoleId,
    dateOfJoining: user?.dateOfJoining ?? "",
  };
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  roles,
}: UserFormDialogProps) {
  const router = useRouter();
  const { toast, toastPasswordReveal } = useToast();
  const { busy: isPending, run: runBusy } = useBusyAction();
  const fallbackRoleId = roles[0]?.id ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamName, setTeamName] = useState("");
  const [roleId, setRoleId] = useState(fallbackRoleId);
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const initialRef = useRef<UserFormSnapshot>(
    snapshotFromUser(null, fallbackRoleId)
  );
  const wasOpenRef = useRef(false);
  const isEditing = !!user;

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === roleId),
    [roles, roleId]
  );
  const isAgentRole = selectedRole?.slug === SYSTEM_ROLE_SLUGS.AGENT;
  const isSupervisorRole = isSupervisorRoleSlug(selectedRole?.slug);
  const roleOptions = useMemo(
    () =>
      roles.map((role) => ({
        value: role.id,
        label: roleOptionLabel(role),
      })),
    [roles]
  );

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const next = snapshotFromUser(user, roles[0]?.id ?? "");
      initialRef.current = next;
      setName(next.name);
      setEmail(next.email);
      setTeamName(next.teamName);
      setRoleId(next.roleId);
      setDateOfJoining(next.dateOfJoining);
      if (!user) {
        const generated = generateClientPassword(12);
        setPassword(generated);
        setConfirmPassword(generated);
      } else {
        setPassword("");
        setConfirmPassword("");
      }
    }
    wasOpenRef.current = open;
  }, [open, user, roles]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const passwordRequired = !isEditing;
    const passwordProvided = password.length > 0;

    if (
      passwordRequired &&
      !isPasswordFormValid(password, confirmPassword, { minLength: 6 })
    ) {
      toast("Enter a matching password of at least 6 characters.", "error");
      return;
    }

    if (
      isEditing &&
      passwordProvided &&
      !isPasswordFormValid(password, confirmPassword, { minLength: 6 })
    ) {
      toast("Enter a matching password of at least 6 characters.", "error");
      return;
    }

    const formData = new FormData();

    if (!isEditing) {
      formData.set("name", name.trim());
      formData.set("email", email.trim());
      formData.set("teamName", teamName);
      formData.set("roleId", roleId);
      if (isAgentRole) {
        formData.set("dateOfJoining", dateOfJoining);
      }
      formData.set("password", password);
    } else {
      formData.set("id", user.id);
      const initial = initialRef.current;
      if (name.trim() !== initial.name) formData.set("name", name.trim());
      if (email.trim() !== initial.email) formData.set("email", email.trim());
      if (teamName !== initial.teamName) formData.set("teamName", teamName);
      if (roleId !== initial.roleId) formData.set("roleId", roleId);
      if (isAgentRole && dateOfJoining !== initial.dateOfJoining) {
        formData.set("dateOfJoining", dateOfJoining);
      }
      if (passwordProvided) {
        formData.set("password", password);
      }

      const changedKeys = [...formData.keys()].filter((key) => key !== "id");
      if (changedKeys.length === 0) {
        toast("No changes to save.", "success");
        onOpenChange(false);
        return;
      }
    }

    void runBusy(async () => {
      const result = isEditing
        ? await updateUser(formData)
        : await createUser(formData);

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      if ("success" in result && result.success && result.password && result.email) {
        toastPasswordReveal(result.email, result.password, {
          note: isEditing
            ? "Password updated. The user must sign in with the new password."
            : "Account created. Share this password securely with the user.",
        });
      } else {
        toast(isEditing ? "User updated." : "User created.", "success");
      }

      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={isEditing ? "Edit user" : "Create user"}
      size="lg"
      description={
        isEditing
          ? "Only fields you change are saved. Leave password blank to keep the current one."
          : "Add a platform user with a user name and team name. Agent users require a joining date; Supervisors require a team name."
      }
    >
      <form key={user?.id ?? "create"} onSubmit={handleSubmit}>
        <FormStack>
          <Field>
            <Label htmlFor="name">User name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={isPending}
              placeholder="Person’s display name on audit forms"
            />
          </Field>

          <Field>
            <Label htmlFor="teamName">
              Team name
              {isSupervisorRole ? <span aria-hidden> *</span> : null}
            </Label>
            <Input
              id="teamName"
              name="teamName"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              required={isSupervisorRole}
              disabled={isPending}
              placeholder="Used for team reporting and filters"
            />
          </Field>

          <Field>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isPending}
            />
          </Field>

          <PasswordField
            id="password"
            label={isEditing ? "New password (optional)" : "Password"}
            value={password}
            onChange={setPassword}
            required={!isEditing}
            disabled={isPending}
            minLength={6}
            showGenerator
            hint={
              isEditing
                ? "Leave blank to keep the current password. Minimum 6 characters when set."
                : "Minimum 6 characters. Use Generate for a secure temporary password."
            }
          />
          {(password.length > 0 || !isEditing) && (
            <PasswordConfirmField
              id="password-confirm"
              password={password}
              value={confirmPassword}
              onChange={setConfirmPassword}
              required={!isEditing || password.length > 0}
              disabled={isPending}
            />
          )}

          <Field>
            <Label htmlFor="roleId">Role</Label>
            <Select
              id="roleId"
              name="roleId"
              value={roleId}
              required
              disabled={isPending || roleOptions.length === 0}
              options={roleOptions}
              aria-label="Role"
              onChange={(e) => setRoleId(e.target.value)}
            />
            {roleOptions.length === 0 ? (
              <p className="ui-form-error">Roles could not be loaded. Close and reopen Users.</p>
            ) : (
              <p className="ui-hint">
                Agent → audit subject · Supervisor → team view · Training Supervisor
                → team view + audits · Quality Analyst → performs audits on forms.
              </p>
            )}
          </Field>

          {isAgentRole && (
            <Field>
              <Label htmlFor="dateOfJoining">
                Date of joining {isEditing ? "" : <span aria-hidden>*</span>}
              </Label>
              <Input
                id="dateOfJoining"
                name="dateOfJoining"
                type="date"
                value={dateOfJoining}
                onChange={(event) => setDateOfJoining(event.target.value)}
                required={!isEditing}
                disabled={isPending}
              />
            </Field>
          )}
        </FormStack>

        <ModalActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            {isEditing ? "Save changes" : "Create user"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
