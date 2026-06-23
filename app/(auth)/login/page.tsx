import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { getServerSession } from "@/lib/auth-session";
import {
  isInvalidSessionError,
  invalidSessionRedirectReason,
} from "@/lib/auth-guards";
import { redirectForInvalidSession } from "@/lib/auth-redirects";
import LoginPage from "./login-page";
import LoginFallback from "./login-fallback";

export default async function Page() {
  const session = await getServerSession();

  if (session?.user?.id) {
    try {
      await requireAuth();
      redirect("/dashboard");
    } catch (error) {
      if (isInvalidSessionError(error)) {
        redirectForInvalidSession("/login", invalidSessionRedirectReason(error));
      }

      if (!(error instanceof Error && error.message === "Unauthorized")) {
        throw error;
      }
    }
  }

  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPage />
    </Suspense>
  );
}
