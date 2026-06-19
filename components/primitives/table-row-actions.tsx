"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type TableRowActionsCellProps = {
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
};

export function TableRowActionsCell({
  children,
  ariaLabel = "Row actions",
  className,
}: TableRowActionsCellProps) {
  return (
    <td className={cn("col-actions settings-table__actions-cell", className)}>
      <span className="settings-table__actions-hint" aria-hidden>
        ⋯
      </span>
      <div
        className="settings-table__actions"
        role="group"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </td>
  );
}

type TableRowActionProps = {
  children: React.ReactNode;
  variant?: "default" | "danger";
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
};

export function TableRowAction({
  children,
  variant = "default",
  disabled,
  onClick,
  href,
  type = "button",
}: TableRowActionProps) {
  const className = cn(
    "settings-table__row-action",
    variant === "danger" && "settings-table__row-action--danger"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
