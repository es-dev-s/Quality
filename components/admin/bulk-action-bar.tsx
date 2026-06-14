"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/primitives/button";

type BulkActionBarProps = {
  selectedCount: number;
  onClear: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  isPending?: boolean;
  children?: React.ReactNode;
};

export function BulkActionBar({
  selectedCount,
  onClear,
  onDelete,
  deleteLabel = "Delete selected",
  isPending,
  children,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-action-bar" role="status">
      <span className="bulk-action-bar__count">
        {selectedCount} selected
      </span>
      <div className="bulk-action-bar__actions">
        {children}
        {onDelete && (
          <Button
            variant="danger"
            size="sm"
            disabled={isPending}
            onClick={onDelete}
          >
            <Trash2 size={14} />
            {deleteLabel}
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled={isPending} onClick={onClear}>
          <X size={14} />
          Clear
        </Button>
      </div>
    </div>
  );
}
