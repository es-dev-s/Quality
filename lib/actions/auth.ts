"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import {
  loginFailureMessage,
  verifyCredentialsForLogin,
} from "@/lib/auth-credentials";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  formatRateLimitRetryMessage,
} from "@/lib/server/rate-limit";
import { loginSchema, safeCallbackUrl } from "@/lib/validation/auth";

export type LoginState = {
  error?: string;
};

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const emailRaw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const sessionWasCleared = formData.get("sessionWasCleared") === "1";

  const hdrs = await headers();
  const clientIp =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip")?.trim() ||
    "unknown";

  const ipLimit = checkRateLimit(`login-ip:${clientIp}`, 15, 60_000);
  if (!ipLimit.allowed) {
    return { error: formatRateLimitRetryMessage(ipLimit.retryAfterMs) };
  }

  if (emailRaw) {
    const emailLimit = checkRateLimit(`login:${emailRaw}`, 5, 30_000);
    if (!emailLimit.allowed) {
      return { error: formatRateLimitRetryMessage(emailLimit.retryAfterMs) };
    }
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") ?? "/dashboard",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid login details.",
    };
  }

  const { email, password } = parsed.data;
  const callbackUrl = safeCallbackUrl(parsed.data.callbackUrl);

  const credentialCheck = await verifyCredentialsForLogin(email, password);
  if (!credentialCheck.ok) {
    if (credentialCheck.reason === "not_approved") {
      const pending = await prisma.userProvisioningRequest.findFirst({
        where: {
          email: email.toLowerCase(),
          status: "PENDING",
        },
        select: { id: true },
      });
      if (pending) {
        return {
          error:
            "This account is still awaiting approval. You can sign in only after a Quality Manager or Admin approves the request in Settings → Team.",
        };
      }
    }

    return {
      error: loginFailureMessage(credentialCheck.reason, {
        sessionWasCleared: sessionWasCleared,
      }),
    };
  }

  try {
    // Drop stale JWT cookies before issuing a new session (fixes re-login after deactivate/activate).
    await signOut({ redirect: false });
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return {};
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    if (error instanceof AuthError && error.type === "CredentialsSignin") {
      return {
        error: loginFailureMessage("invalid_password", {
          sessionWasCleared: sessionWasCleared,
        }),
      };
    }
    console.error("[auth] loginAction failed:", error);
    return {
      error: loginFailureMessage("db_error"),
    };
  }
}
