"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label } from "@/components/primitives/field";
import { FormStack, Modal, ModalActions } from "@/components/primitives/modal";
import { useToast } from "@/components/primitives/toast";
import { createRole, updateRole } from "@/lib/actions/admin";

type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
};

type RoleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
};

export function RoleFormDialog({ open, onOpenChange, role }: RoleFormDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!role;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = isEditing
        ? await updateRole(formData)
        : await createRole(formData);

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      toast(isEditing ? "Role updated" : "Role created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={isEditing ? "Edit Role" : "Create Role"}
      description="Roles define access levels. Scopes can be attached later."
    >
      <form action={handleSubmit}>
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
              disabled={role?.isSystem || isPending}
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
