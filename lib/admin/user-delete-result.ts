export type UserBulkDeleteResult = {
  error?: string;
  deleted?: number;
  skipped?: { id: string; email: string; reason: string }[];
};

type ToastFn = (message: string, variant?: "success" | "error") => void;

export function toastUserDeleteResult(
  result: UserBulkDeleteResult,
  toast: ToastFn,
  options?: { single?: boolean }
): boolean {
  if (result.error && !result.deleted) {
    toast(result.error, "error");
    return false;
  }

  if (result.deleted) {
    toast(
      options?.single
        ? "User deleted"
        : `Deleted ${result.deleted} user${result.deleted === 1 ? "" : "s"}`,
      "success"
    );
  } else if (options?.single && result.skipped?.length) {
    toast(
      `Cannot delete — ${result.skipped[0]?.reason ?? "user has audit records"}.`,
      "error"
    );
    return false;
  } else if (options?.single && !result.error) {
    toast("User could not be deleted.", "error");
    return false;
  }

  if (result.skipped?.length) {
    toast(
      `${result.skipped.length} skipped: ${result.skipped
        .map((item) => item.email)
        .join(", ")}`,
      "error"
    );
  }

  return (result.deleted ?? 0) > 0 || Boolean(result.skipped?.length);
}
