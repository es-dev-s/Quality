"use client";

import { cn } from "@/lib/utils";
import { resolveSelectPortalTarget } from "@/lib/ui/select-portal";
import { Check, ChevronDown, Search } from "lucide-react";
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
  type KeyboardEvent as ReactKeyboardEvent,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

type OptionItem = { value: string; label: string; disabled?: boolean };

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Prefer this in filter panels — avoids fragile option-child parsing. */
  options?: OptionItem[];
  /** Show a typeahead field in the open menu (user lists, long option sets). */
  searchable?: boolean;
  searchPlaceholder?: string;
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

function optionMatchesQuery(option: OptionItem, query: string): boolean {
  if (!query) return true;
  return option.label.toLowerCase().includes(query);
}

function measureMenu(trigger: HTMLElement, searchable: boolean): MenuLayout {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const padding = 8;
  const preferredMax = searchable ? 320 : 280;
  const spaceBelow = window.innerHeight - rect.bottom - padding;
  const spaceAbove = rect.top - padding;
  const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    searchable ? 160 : 112,
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
      searchable = false,
      searchPlaceholder = "Search…",
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
    const searchRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [highlightIndex, setHighlightIndex] = useState(0);
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
      if (optionsProp) return optionsProp;
      return parseOptions(children);
    }, [optionsProp, children]);
    const selected =
      options.find((option) => option.value === currentValue) ?? {
        value: currentValue,
        label: currentValue || "Select",
      };

    const normalizedQuery = query.trim().toLowerCase();
    const visibleOptions = useMemo(
      () =>
        searchable
          ? options.filter((option) =>
              optionMatchesQuery(option, normalizedQuery)
            )
          : options,
      [options, searchable, normalizedQuery]
    );

    useEffect(() => {
      if (controlled) {
        setInternalValue(String(value));
      }
    }, [controlled, value]);

    useEffect(() => {
      if (!open) {
        setQuery("");
        setHighlightIndex(0);
      }
    }, [open]);

    useEffect(() => {
      setHighlightIndex(0);
    }, [normalizedQuery, visibleOptions.length]);

    useLayoutEffect(() => {
      if (!open || !triggerRef.current) {
        setMenuLayout(null);
        setPortalTarget(null);
        return;
      }

      const updateLayout = () => {
        if (!triggerRef.current) return;
        setPortalTarget(resolveSelectPortalTarget(triggerRef.current));
        setMenuLayout(measureMenu(triggerRef.current, searchable));
      };

      updateLayout();
      window.addEventListener("resize", updateLayout);
      window.addEventListener("scroll", updateLayout, true);
      return () => {
        window.removeEventListener("resize", updateLayout);
        window.removeEventListener("scroll", updateLayout, true);
      };
    }, [open, options.length, searchable]);

    useLayoutEffect(() => {
      if (!open || !searchable) return;
      searchRef.current?.focus();
    }, [open, searchable]);

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

    function moveHighlight(delta: number) {
      if (visibleOptions.length === 0) return;
      setHighlightIndex((current) => {
        const next = (current + delta + visibleOptions.length) % visibleOptions.length;
        return next;
      });
    }

    function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveHighlight(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveHighlight(-1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const option = visibleOptions[highlightIndex] ?? visibleOptions[0];
        if (option && !option.disabled) {
          selectOption(option.value);
        }
      }
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

    const optionList = (
      <ul
        id={listboxId}
        className={cn(
          "ui-custom-select__list ui-scrollbar",
          !searchable && "ui-custom-select__menu ui-custom-select__menu--portal"
        )}
        style={searchable ? undefined : menuStyle}
        role="listbox"
        data-select-menu={searchable ? undefined : listboxId}
      >
        {visibleOptions.length === 0 ? (
          <li role="presentation">
            <p className="ui-custom-select__empty">No matches</p>
          </li>
        ) : (
          visibleOptions.map((option, index) => (
            <li key={`${option.value || "__empty__"}-${index}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.value === currentValue}
                className={cn(
                  "ui-custom-select__option",
                  option.value === currentValue &&
                    "ui-custom-select__option--selected",
                  searchable &&
                    index === highlightIndex &&
                    "ui-custom-select__option--active"
                )}
                disabled={option.disabled}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => selectOption(option.value)}
              >
                <span>{option.label}</span>
                {option.value === currentValue ? (
                  <Check size={14} aria-hidden />
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    );

    const menu =
      open && menuLayout && portalTarget ? (
        searchable ? (
          <div
            data-select-menu={listboxId}
            className="ui-custom-select__menu ui-custom-select__menu--portal ui-custom-select__menu--searchable"
            style={menuStyle}
          >
            <div className="ui-custom-select__search">
              <Search size={14} aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>
            {optionList}
          </div>
        ) : (
          optionList
        )
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
