import bcrypt from "bcryptjs";
import { resolveEffectiveScopes } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { SessionRole } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";

const userWithRoleInclude = {
  role: {
    include: {
      scopes: {
        include: { scope: true },
      },
    },
  },
} satisfies Prisma.UserInclude;

type AuthUserRecord = Prisma.UserGetPayload<{
  include: typeof userWithRoleInclude;
}>;

export type VerifiedAuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: SessionRole;
  sessionVersion: number;
};

export type CredentialFailureReason =
  | "missing"
  | "not_found"
  | "inactive"
  | "not_approved"
  | "invalid_password"
  | "db_error";

export type CredentialCheckResult =
  | { ok: true; user: VerifiedAuthUser }
  | { ok: false; reason: CredentialFailureReason };

function mapSessionRole(user: AuthUserRecord): SessionRole {
  const dbScopes = user.role.scopes.map((entry) => entry.scope.slug);
  return {
    id: user.role.id,
    name: user.role.name,
    slug: user.role.slug,
    scopes: resolveEffectiveScopes(user.role.slug, dbScopes),
  };
}

function toVerifiedUser(user: AuthUserRecord): VerifiedAuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: mapSessionRole(user),
    sessionVersion: user.sessionVersion,
  };
}

export async function verifyCredentialsForLogin(
  emailRaw: string,
  passwordRaw: string
): Promise<CredentialCheckResult> {
  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw;

  if (!email || !password) {
    return { ok: false, reason: "missing" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: userWithRoleInclude,
    });

    if (!user) {
      return { ok: false, reason: "not_found" };
    }

    if (!user.isActive) {
      return { ok: false, reason: "inactive" };
    }

    if (user.approvalStatus !== "ACTIVE") {
      return { ok: false, reason: "not_approved" };
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return { ok: false, reason: "invalid_password" };
    }

    return { ok: true, user: toVerifiedUser(user) };
  } catch (error) {
    console.error("[auth] Credential verification failed:", error);
    return { ok: false, reason: "db_error" };
  }
}

export function loginFailureMessage(
  reason: CredentialFailureReason,
  options?: { sessionWasCleared?: boolean }
): string {
  switch (reason) {
    case "inactive":
      return "This account has been deactivated. Contact your administrator.";
    case "not_approved":
      return "This account is not approved yet. Sign in after an admin approves your request.";
    case "db_error":
      return "Unable to sign in right now. Check your database connection and try again.";
    case "invalid_password":
      if (options?.sessionWasCleared) {
        return "Invalid email or password. If an admin reset your password, use the new password from the copy toast.";
      }
      return "Invalid email or password.";
    case "missing":
    case "not_found":
    default:
      return "Invalid email or password.";
  }
}
