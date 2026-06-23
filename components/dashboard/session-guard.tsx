"use client";

import { useRealtime } from "@/components/dashboard/realtime-provider";
import { CLEAR_SESSION_PATH } from "@/lib/auth-redirects";

type SessionGuardProps = {
  userId: string;
};

/**
 * Forces sign-out on the user's device when an admin deactivates their account.
 * Prevents stale JWT cookies from blocking re-login after reactivation.
 */
export function SessionGuard({ userId }: SessionGuardProps) {
  useRealtime((event) => {
    if (event.type !== "user:deactivated" || event.userId !== userId) {
      return;
    }

    const params = new URLSearchParams({
      reason: "deactivated",
      callbackUrl: "/login",
    });
    window.location.assign(`${CLEAR_SESSION_PATH}?${params.toString()}`);
  });

  return null;
}
