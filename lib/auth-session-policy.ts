import type { UserApprovalStatus } from "@prisma/client";
import { isLoginEligibleUser } from "@/lib/user-active-filter";

export type SessionEligibilityInput = {
  isActive: boolean;
  approvalStatus: UserApprovalStatus | string;
  sessionVersion: number;
};

export type SessionTokenInput = {
  sessionVersion?: number | null;
};

export type SessionValidationFailure =
  | "inactive"
  | "not_approved"
  | "session_revoked";

export { isLoginEligibleUser };

export function validateSessionAgainstUser(
  token: SessionTokenInput,
  user: SessionEligibilityInput
): SessionValidationFailure | null {
  if (!user.isActive) {
    return "inactive";
  }

  if (user.approvalStatus !== "ACTIVE") {
    return "not_approved";
  }

  const tokenSessionVersion = Number(token.sessionVersion ?? 0);
  const dbSessionVersion = Number(user.sessionVersion ?? 0);
  if (dbSessionVersion > tokenSessionVersion) {
    return "session_revoked";
  }

  return null;
}

export function invalidSessionRedirectReason(
  failure: SessionValidationFailure
): "session" | "deactivated" | "not_approved" {
  if (failure === "inactive") {
    return "deactivated";
  }
  if (failure === "not_approved") {
    return "not_approved";
  }
  return "session";
}
