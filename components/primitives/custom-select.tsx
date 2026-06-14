"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type SelectHTMLAttributes,
} from "react";

type OptionItem = { value: string; label: string; disabled?: boolean };

function parseOptions(children: React.ReactNode): OptionItem[] {
  const options: OptionItem[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const props = child.props as {
        value?: string;
        disabled?: boolean;
        children?: React.ReactNode;
      };
      options.push({
        value: props.value ?? "",
        label: String(props.children ?? ""),
        disabled: props.disabled,
      });
    }
  });
  return options;
}

export const Select = forwardRef<HTMLButtonElement, SelectHTMLAttributes<HTMLSelectElement>>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      id,
      disabled,
      name,
      required,
      "aria-label": ariaLabel,
    },
    ref
  ) => {
    const listboxId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(() =>
      String(value ?? defaultValue ?? "")
    );

    useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const controlled = value !== undefined;
    const currentValue = controlled ? String(value) : internalValue;

    const options = useMemo(() => parseOptions(children), [children]);
    const selected =
      options.find((option) => option.value === currentValue) ?? options[0];

    useEffect(() => {
      if (controlled) {
        setInternalValue(String(value));
      }
    }, [controlled, value]);

    useEffect(() => {
      if (!open) return;

      const onDocumentMouseDown = (event: MouseEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) {
          setOpen(false);
        }
      };

      const onDocumentKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      };

      document.addEventListener("mousedown", onDocumentMouseDown);
      document.addEventListener("keydown", onDocumentKeyDown);
      return () => {
        document.removeEventListener("mousedown", onDocumentMouseDown);
        document.removeEventListener("keydown", onDocumentKeyDown);
      };
    }, [open]);

    function selectOption(nextValue: string) {
      if (!controlled) {
        setInternalValue(nextValue);
      }

      onChange?.({
        target: { value: nextValue, name: name ?? "" },
        currentTarget: { value: nextValue, name: name ?? "" },
      } as React.ChangeEvent<HTMLSelectElement>);
      setOpen(false);
      triggerRef.current?.focus();
    }

    return (
      <div
        ref={rootRef}
        className="ui-custom-select"
        data-open={open ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
      >
        {name ? (
          <input
            type="hidden"
            name={name}
            value={currentValue}
            required={required}
            tabIndex={-1}
            aria-hidden
          />
        ) : null}
        <button
          ref={triggerRef}
          type="button"
          id={id}
          className={cn("ui-custom-select__trigger ui-select", className)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={ariaLabel}
          onClick={() => {
            if (!disabled) {
              setOpen((current) => !current);
            }
          }}
        >
          <span className="ui-custom-select__value">
            {selected?.label ?? "Select"}
          </span>
          <ChevronDown
            size={16}
            className="ui-custom-select__chevron"
            aria-hidden
          />
        </button>
        {open ? (
          <ul id={listboxId} className="ui-custom-select__menu ui-scrollbar" role="listbox">
            {options.map((option) => (
              <li key={option.value || "__empty__"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === currentValue}
                  className={cn(
                    "ui-custom-select__option",
                    option.value === currentValue &&
                      "ui-custom-select__option--selected"
                  )}
                  disabled={option.disabled}
                  onClick={() => selectOption(option.value)}
                >
                  <span>{option.label}</span>
                  {option.value === currentValue ? (
                    <Check size={14} aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
