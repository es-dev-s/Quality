/** Shared stacking order — keep dropdown portals above modals, below toasts. */
export const Z_INDEX = {
  dropdownInHost: 25,
  dropdownPortal: 360,
  modal: 300,
  modalStack: 350,
  toast: 400,
} as const;
