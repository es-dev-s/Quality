"use client";

import { cn } from "@/lib/utils";
import { shouldDeferOverlayClose } from "@/lib/ui/open-overlays";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  rootClassName?: string;
  size?: "sm" | "md" | "lg";
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  rootClassName,
  size = "md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (shouldDeferOverlayClose()) return;
        onClose();
      }
    }

    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={cn("ui-modal-root", rootClassName)}>
      <button
        type="button"
        aria-label="Close dialog"
        className="ui-modal-backdrop"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "ui-modal-panel",
          size === "sm" && "ui-modal-panel--sm",
          size === "lg" && "ui-modal-panel--lg",
          className
        )}
      >
        <h2 id="modal-title" className="ui-modal-panel__title">
          {title}
        </h2>
        {description && (
          <p className="ui-modal-panel__desc">{description}</p>
        )}
        <div className="ui-modal-panel__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function ModalActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-modal-actions", className)} {...props} />;
}

export function FormStack({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-form-stack", className)} {...props} />;
}
