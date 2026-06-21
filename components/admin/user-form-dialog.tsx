"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  roles: Role[];
};

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  roles,
}: UserFormDialogProps) {
  const router = useRouter();
  const { toast, toastPasswordReveal } = useToast();
  const { busy: isPending, run: runBusy } = useBusyAction();
  const [roleId, setRoleId] = useState(user?.roleId ?? roles[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const isEditing = !!user;

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === roleId),
    [roles, roleId]
  );
  const isAgentRole = selectedRole?.slug === SYSTEM_ROLE_SLUGS.AGENT;

  useEffect(() => {
    if (open) {
      setRoleId(user?.roleId ?? roles[0]?.id ?? "");
      if (!user) {
        const generated = generateClientPassword(12);
        setPassword(generated);
        setConfirmPassword(generated);
      } else {
        setPassword("");
        setConfirmPassword("");
      }
    }
  }, [open, user, roles]);

  function handleSubmit(formData: FormData) {
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

    if (passwordProvided) {
      formData.set("password", password);
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
          ? "Update profile details and role. Leave password blank to keep the current one."
          : "Add a platform user with a system role. Agent users require a joining date."
      }
    >
      <form action={handleSubmit}>
        <FormStack>
          {isEditing && <input type="hidden" name="id" value={user.id} />}

          <Field>
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={user?.name ?? ""}
              required
              disabled={isPending}
              placeholder="Used on audit forms and data filters"
            />
          </Field>

          <Field>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={user?.email ?? ""}
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
              disabled={isPending}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {roleOptionLabel(role)}
                </option>
              ))}
            </Select>
            <p className="ui-hint">
              Agent → audit subject · Supervisor → team view · Quality Analyst →
              performs audits on forms.
            </p>
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
                defaultValue={user?.dateOfJoining ?? ""}
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
