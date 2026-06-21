import type { Prisma } from "@prisma/client";

/** Platform users eligible for login and user-picker dropdowns. */
export const ACTIVE_USER_WHERE = {
  isActive: true,
  approvalStatus: "ACTIVE",
} as const satisfies Prisma.UserWhereInput;

export function withActiveUserFilter(
  where: Prisma.UserWhereInput = {}
): Prisma.UserWhereInput {
  return { AND: [where, ACTIVE_USER_WHERE] };
}

export function isLoginEligibleUser(user: {
  isActive: boolean;
  approvalStatus: string;
}): boolean {
  return user.isActive && user.approvalStatus === "ACTIVE";
}
