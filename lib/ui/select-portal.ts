import { Z_INDEX } from "@/lib/ui/z-index";

const MODAL_HOST_SELECTOR = ".ui-modal-root, .platform-modal";

export type SelectPortalTarget = {
  container: HTMLElement;
  zIndex: number;
};

/** Portal into an open modal when the trigger lives inside one; otherwise use body. */
export function resolveSelectPortalTarget(
  trigger: HTMLElement
): SelectPortalTarget {
  const modalHost = trigger.closest(MODAL_HOST_SELECTOR);
  if (modalHost instanceof HTMLElement) {
    return { container: modalHost, zIndex: Z_INDEX.dropdownInHost };
  }

  return { container: document.body, zIndex: Z_INDEX.dropdownPortal };
}
