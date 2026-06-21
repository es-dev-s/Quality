"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  PERMISSION_CATALOG,
  type PermissionGroup,
} from "@/lib/permission-catalog";
import type { Permission } from "@/lib/permissions";

type ScopePickerProps = {
  value: Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
};

function togglePermission(
  current: Permission[],
  slug: Permission
): Permission[] {
  return current.includes(slug)
    ? current.filter((item) => item !== slug)
    : [...current, slug];
}

function toggleGroup(
  current: Permission[],
  group: PermissionGroup
): Permission[] {
  const slugs = group.permissions.map((entry) => entry.slug);
  const allSelected = slugs.every((slug) => current.includes(slug));
  if (allSelected) {
    return current.filter((slug) => !slugs.includes(slug));
  }
  const next = new Set([...current, ...slugs]);
  return [...next];
}

export function ScopePicker({ value, onChange, disabled }: ScopePickerProps) {
  const selectedCount = value.length;

  const groupedSummary = useMemo(
    () =>
      PERMISSION_CATALOG.map((group) => ({
        group,
        selected: group.permissions.filter((entry) =>
          value.includes(entry.slug)
        ).length,
        total: group.permissions.length,
      })),
    [value]
  );

  return (
    <div className="scope-picker">
      <div className="scope-picker__head">
        <p className="scope-picker__title">Module permissions</p>
        <p className="scope-picker__desc">
          {selectedCount === 0
            ? "Select at least one permission so users with this role can sign in."
            : `${selectedCount} permission${selectedCount === 1 ? "" : "s"} selected`}
        </p>
      </div>

      <div className="scope-picker__groups">
        {groupedSummary.map(({ group, selected, total }) => (
          <section key={group.id} className="scope-picker__group">
            <div className="scope-picker__group-head">
              <button
                type="button"
                className="scope-picker__group-toggle"
                disabled={disabled}
                onClick={() => onChange(toggleGroup(value, group))}
              >
                <span className="scope-picker__group-label">{group.label}</span>
                <span className="scope-picker__group-count">
                  {selected}/{total}
                </span>
              </button>
              {group.description ? (
                <p className="scope-picker__group-desc">{group.description}</p>
              ) : null}
            </div>

            <ul className="scope-picker__list">
              {group.permissions.map((entry) => {
                const checked = value.includes(entry.slug);
                return (
                  <li key={entry.slug}>
                    <label
                      className={cn(
                        "scope-picker__item",
                        checked && "scope-picker__item--checked"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() =>
                          onChange(togglePermission(value, entry.slug))
                        }
                      />
                      <span className="scope-picker__item-body">
                        <span className="scope-picker__item-label">
                          {entry.label}
                        </span>
                        {entry.hint ? (
                          <span className="scope-picker__item-hint">
                            {entry.hint}
                          </span>
                        ) : null}
                        <code className="scope-picker__item-slug">
                          {entry.slug}
                        </code>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
