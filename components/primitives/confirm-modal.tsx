"use client";

import { Button } from "@/components/primitives/button";
import { Modal, ModalActions } from "@/components/primitives/modal";

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  confirmDisabled?: boolean;
  danger?: boolean;
};

/** Standard delete / confirm dialog for CRUD operations. */
export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  loading = false,
  confirmDisabled = false,
  danger = true,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      title={title}
      description={description}
      className="ui-modal-panel--confirm"
    >
      <ModalActions>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={danger ? "danger" : "primary"}
          loading={loading}
          disabled={confirmDisabled || loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </ModalActions>
    </Modal>
  );
}
