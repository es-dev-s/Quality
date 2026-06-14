"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label, Select } from "@/components/primitives/field";
import { FormStack, Modal, ModalActions } from "@/components/primitives/modal";
import { useToast } from "@/components/primitives/toast";
import { createUser, updateUser } from "@/lib/actions/admin";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

type Role = {
  id: string;
  name: string;
  slug: string;
  isSystem?: boolean;
  _count?: { scopes: number };
};

function roleOptionLabel(role: Role) {
  const suffix = role.isSystem ? " (system)" : "";
  const scopeHint =
    !role.isSystem && role._count?.scopes === 0 ? " — no permissions" : "";
  return `${role.name}${suffix}${scopeHint}`;
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
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [roleId, setRoleId] = useState(user?.roleId ?? roles[0]?.id ?? "");
  const isEditing = !!user;

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === roleId),
    [roles, roleId]
  );
  const isAgentRole = selectedRole?.slug === SYSTEM_ROLE_SLUGS.AGENT;

  useEffect(() => {
    if (open) {
      setRoleId(user?.roleId ?? roles[0]?.id ?? "");
    }
  }, [open, user, roles]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = isEditing
        ? await updateUser(formData)
        : await createUser(formData);

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      toast(isEditing ? "User updated" : "User created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={isEditing ? "Edit User" : "Create User"}
      description={
        isEditing
          ? "Update user details and role assignment."
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

          <Field>
            <Label htmlFor="password">
              Password {isEditing && "(leave blank to keep current)"}
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required={!isEditing}
              minLength={isEditing ? undefined : 6}
              disabled={isPending}
            />
          </Field>

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
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
