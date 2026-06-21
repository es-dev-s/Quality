"use client";

import { Select } from "@/components/primitives/field";

export type FilterSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type FilterSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  ariaLabel: string;
  className?: string;
};

/** Explicit-options select for filter sidebars (reliable vs. option-child parsing). */
export function FilterSelect({
  id,
  value,
  onChange,
  options,
  ariaLabel,
  className = "dash-select dash-select--filter",
}: FilterSelectProps) {
  return (
    <Select
      id={id}
      className={className}
      value={value}
      aria-label={ariaLabel}
      options={options}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
