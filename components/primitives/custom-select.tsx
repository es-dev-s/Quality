"use client";

import { cn } from "@/lib/utils";
import { resolveSelectPortalTarget } from "@/lib/ui/select-portal";
import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

type OptionItem = { value: string; label: string; disabled?: boolean };

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Prefer this in filter panels — avoids fragile option-child parsing. */
  options?: OptionItem[];
};

function isOptionElement(child: React.ReactElement): boolean {
  return typeof child.type === "string" && child.type.toLowerCase() === "option";
}

function parseOptions(children: React.ReactNode): OptionItem[] {
  const options: OptionItem[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (isOptionElement(child)) {
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

function measureMenu(trigger: HTMLElement): MenuLayout {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const padding = 8;
  const preferredMax = 280;
  const spaceBelow = window.innerHeight - rect.bottom - padding;
  const spaceAbove = rect.top - padding;
  const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    112,
    Math.min(preferredMax, openUp ? spaceAbove - gap : spaceBelow - gap)
  );
  const top = openUp
    ? Math.max(padding, rect.top - gap - maxHeight)
    : rect.bottom + gap;
  const width = Math.max(rect.width, 160);
  const left = Math.min(
    Math.max(padding, rect.left),
    window.innerWidth - width - padding
  );

  return { top, left, width, maxHeight };
}

type MenuLayout = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      children,
      options: optionsProp,
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
    const [menuLayout, setMenuLayout] = useState<MenuLayout | null>(null);
    const [portalTarget, setPortalTarget] = useState<{
      container: HTMLElement;
      zIndex: number;
    } | null>(null);
    const [internalValue, setInternalValue] = useState(() =>
      String(value ?? defaultValue ?? "")
    );

    useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const controlled = value !== undefined;
    const currentValue = controlled ? String(value) : internalValue;

    const options = useMemo(() => {
      if (optionsProp && optionsProp.length > 0) return optionsProp;
      return parseOptions(children);
    }, [optionsProp, children]);
    const selected =
      options.find((option) => option.value === currentValue) ?? options[0];

    useEffect(() => {
      if (controlled) {
        setInternalValue(String(value));
      }
    }, [controlled, value]);

    useLayoutEffect(() => {
      if (!open || !triggerRef.current) {
        setMenuLayout(null);
        setPortalTarget(null);
        return;
      }

      const updateLayout = () => {
        if (!triggerRef.current) return;
        setPortalTarget(resolveSelectPortalTarget(triggerRef.current));
        setMenuLayout(measureMenu(triggerRef.current));
      };

      updateLayout();
      window.addEventListener("resize", updateLayout);
      window.addEventListener("scroll", updateLayout, true);
      return () => {
        window.removeEventListener("resize", updateLayout);
        window.removeEventListener("scroll", updateLayout, true);
      };
    }, [open, options.length]);

    useEffect(() => {
      if (!open) return;

      const onDocumentMouseDown = (event: MouseEvent) => {
        const target = event.target as Node;
        if (rootRef.current?.contains(target)) return;
        if (
          target instanceof Element &&
          target.closest(`[data-select-menu="${listboxId}"]`)
        ) {
          return;
        }
        setOpen(false);
      };

      const onDocumentKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
        }
      };

      document.addEventListener("mousedown", onDocumentMouseDown);
      document.addEventListener("keydown", onDocumentKeyDown);
      return () => {
        document.removeEventListener("mousedown", onDocumentMouseDown);
        document.removeEventListener("keydown", onDocumentKeyDown);
      };
    }, [open, listboxId]);

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

    const menuStyle: CSSProperties | undefined =
      menuLayout && portalTarget
        ? {
            position: "fixed",
            top: menuLayout.top,
            left: menuLayout.left,
            width: menuLayout.width,
            maxHeight: menuLayout.maxHeight,
            zIndex: portalTarget.zIndex,
          }
        : undefined;

    const menu =
      open && menuLayout && portalTarget ? (
        <ul
          id={listboxId}
          data-select-menu={listboxId}
          className="ui-custom-select__menu ui-custom-select__menu--portal ui-scrollbar"
          style={menuStyle}
          role="listbox"
        >
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
      ) : null;

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
        {typeof document !== "undefined" && menu && portalTarget
          ? createPortal(menu, portalTarget.container)
          : null}
      </div>
    );
  }
);

Select.displayName = "Select";
