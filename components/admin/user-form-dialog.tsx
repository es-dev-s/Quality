"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label, Select } from "@/components/primitives/field";
import { FormStack, Modal, ModalActions } from "@/components/primitives/modal";
import { useToast } from "@/components/primitives/toast";
import { createUser, updateUser } from "@/lib/actions/admin";

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
  const isEditing = !!user;

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
          : "Add a new user and assign a role."
      }
    >
      <form action={handleSubmit}>
        <FormStack>
          {isEditing && <input type="hidden" name="id" value={user.id} />}

          <Field>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={user?.name ?? ""}
              required
              disabled={isPending}
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
              defaultValue={user?.roleId ?? roles[0]?.id}
              required
              disabled={isPending}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {roleOptionLabel(role)}
                </option>
              ))}
            </Select>
            <p className="ui-hint">
              Use a system role (Agent, Supervisor, Quality Analyst, etc.) for
              predefined module access. Custom roles need scopes before users can
              sign in.
            </p>
          </Field>
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
