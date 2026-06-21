/** True when a custom Select dropdown is open (portaled menu). */
export function hasOpenCustomSelect(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector('.ui-custom-select[data-open="true"]'));
}

/** True when an audit reference attachment picker menu is open. */
export function hasOpenReferenceAttachMenu(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector(".audit-ref-attach__menu--portal"));
}

/** Block modal/dialog Escape close while a nested overlay picker is open. */
export function shouldDeferOverlayClose(): boolean {
  return hasOpenCustomSelect() || hasOpenReferenceAttachMenu();
}
