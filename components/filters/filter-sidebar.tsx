"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasOpenCustomSelect } from "@/lib/ui/open-overlays";

type FilterSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  activeCount?: number;
  onClearAll?: () => void;
  clearDisabled?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function subscribeToClientReady() {
  return () => {};
}

function getClientReadySnapshot() {
  return true;
}

function getServerReadySnapshot() {
  return false;
}

function useClientReady() {
  return useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot
  );
}

export function FilterSidebar({
  open,
  onOpenChange,
  title = "Filters",
  description,
  activeCount = 0,
  onClearAll,
  clearDisabled,
  children,
  footer,
}: FilterSidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const clientReady = useClientReady();

  useEffect(() => {
    if (open) {
      document.body.dataset.filterSidebarOpen = "true";
    } else {
      delete document.body.dataset.filterSidebarOpen;
    }
    return () => {
      delete document.body.dataset.filterSidebarOpen;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    lastActiveRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (hasOpenCustomSelect()) return;
      event.preventDefault();
      onOpenChange(false);
    }

    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
      lastActiveRef.current?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!clientReady) {
    return null;
  }

  return createPortal(
    <div
      className={cn("filter-sidebar-root", open && "filter-sidebar-root--open")}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="filter-sidebar-backdrop"
        aria-label="Close filters"
        tabIndex={open ? 0 : -1}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-labelledby="filter-sidebar-title"
        className="filter-sidebar-panel"
      >
        <div className="filter-sidebar-panel__head">
          <div className="filter-sidebar-panel__title-wrap">
            <h2 id="filter-sidebar-title" className="filter-sidebar-panel__title">
              {title}
              {activeCount > 0 ? (
                <span className="filter-trigger-btn__badge" style={{ marginLeft: 8 }}>
                  {activeCount}
                </span>
              ) : null}
            </h2>
            {description ? (
              <p className="filter-sidebar-panel__desc">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="filter-sidebar-panel__close"
            aria-label="Close filters"
            tabIndex={open ? 0 : -1}
            onClick={() => onOpenChange(false)}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="filter-sidebar-panel__body">{children}</div>

        <div className="filter-sidebar-panel__foot">
          {onClearAll ? (
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              disabled={clearDisabled || activeCount === 0}
              tabIndex={open ? 0 : -1}
              onClick={onClearAll}
            >
              Clear all filters
            </button>
          ) : (
            <span />
          )}
          {footer ?? (
            <button
              type="button"
              className="ui-btn ui-btn--primary ui-btn--sm"
              tabIndex={open ? 0 : -1}
              onClick={() => onOpenChange(false)}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function FilterSidebarSection({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("filter-sidebar-section", className)}>
      <span className="filter-sidebar-section__label">{label}</span>
      {children}
    </section>
  );
}

export function FilterSidebarGrid({ children }: { children: React.ReactNode }) {
  return <div className="filter-sidebar-section__grid">{children}</div>;
}
