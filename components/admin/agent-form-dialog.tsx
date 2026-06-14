"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/primitives/modal";
import { Field, Input, Label } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import {
  createAgent,
  updateAgent,
  type AgentListItem,
} from "@/lib/actions/agents";

type AgentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentListItem | null;
};

export function AgentFormDialog({
  open,
  onOpenChange,
  agent,
}: AgentFormDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(agent?.name ?? "");
    setDateOfJoining(agent?.dateOfJoining ?? "");
    setIsActive(agent?.isActive ?? true);
  }, [open, agent]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        dateOfJoining: dateOfJoining.trim() || null,
        isActive,
      };

      const result = agent
        ? await updateAgent({ id: agent.id, ...payload })
        : await createAgent(payload);

      if (!result.ok) {
        toast(result.error, "error");
        return;
      }

      toast(agent ? "Agent updated" : "Agent added", "success");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onOpenChange(false)}
      title={agent ? "Edit agent" : "Add agent"}
      description="Agents appear in audit form dropdowns when active."
    >
      <form className="agent-form-dialog" onSubmit={handleSubmit}>
        <Field>
          <Label htmlFor="agent-name">Full name</Label>
          <Input
            id="agent-name"
            value={name}
            required
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent full name"
          />
        </Field>

        <Field>
          <Label htmlFor="agent-doj">Date of joining</Label>
          <Input
            id="agent-doj"
            type="date"
            value={dateOfJoining}
            disabled={pending}
            onChange={(e) => setDateOfJoining(e.target.value)}
          />
        </Field>

        <label className="agent-form-dialog__check">
          <input
            type="checkbox"
            checked={isActive}
            disabled={pending}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (visible on audit form)
        </label>

        <div className="agent-form-dialog__actions">
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={pending}>
            {pending ? "Saving…" : agent ? "Save changes" : "Add agent"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
