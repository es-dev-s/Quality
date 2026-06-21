"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label } from "@/components/primitives/field";
import { FormStack, Modal, ModalActions } from "@/components/primitives/modal";
import { useToast } from "@/components/primitives/toast";
import { RoleAccessSummary } from "@/components/admin/role-access-matrix";
import { ScopePicker } from "@/components/admin/scope-picker";
import { useBusyAction } from "@/lib/hooks/use-busy-action";
import { createRole, updateRole } from "@/lib/actions/admin";
import { isValidPermissionSlug } from "@/lib/permission-catalog";
import { isDefinedSystemRole, type Permission } from "@/lib/permissions";

type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  scopes?: { scope: { slug: string } }[];
};

type RoleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
};

function initialScopes(role: Role | null): Permission[] {
  if (!role?.scopes?.length) return [];
  return role.scopes
    .map((entry) => entry.scope.slug)
    .filter((slug): slug is Permission => isValidPermissionSlug(slug));
}

export function RoleFormDialog({ open, onOpenChange, role }: RoleFormDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { busy: isPending, run: runBusy } = useBusyAction();
  const isEditing = !!role;
  const isSystemRole = Boolean(role?.isSystem);
  const [selectedScopes, setSelectedScopes] = useState<Permission[]>(() =>
    initialScopes(role)
  );

  useEffect(() => {
    if (open) {
      setSelectedScopes(initialScopes(role));
    }
  }, [open, role]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (!isSystemRole) {
      formData.set("scopeSlugs", JSON.stringify(selectedScopes));
    }

    void runBusy(async () => {
      const result = isEditing
        ? await updateRole(formData)
        : await createRole(formData);

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      if (!isSystemRole && selectedScopes.length === 0) {
        toast(
          "Role saved without permissions. Assign scopes before assigning users.",
          "error"
        );
      } else {
        toast(isEditing ? "Role updated" : "Role created");
      }

      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={isEditing ? "Edit Role" : "Create Role"}
      description={
        isSystemRole
          ? "System roles use predefined permissions and cannot be edited."
          : "Define the role and assign module permissions."
      }
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <FormStack>
          {isEditing && <input type="hidden" name="id" value={role.id} />}

          <Field>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={role?.name ?? ""}
              required
              disabled={isPending}
            />
          </Field>

          <Field>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={role?.slug ?? ""}
              disabled={isSystemRole || isPending}
              pattern="[a-z0-9-]+"
            />
            <p className="ui-hint">
              Lowercase letters, numbers, and hyphens only
            </p>
          </Field>

          <Field>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              defaultValue={role?.description ?? ""}
              disabled={isPending}
            />
          </Field>

          {isSystemRole && role && isDefinedSystemRole(role.slug) ? (
            <RoleAccessSummary slug={role.slug} />
          ) : (
            <ScopePicker
              value={selectedScopes}
              onChange={setSelectedScopes}
              disabled={isPending}
            />
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
            {isEditing ? "Save Changes" : "Create"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
