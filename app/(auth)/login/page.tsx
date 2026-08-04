import { Suspense } from "react";
import LoginPage from "./login-page";
import LoginFallback from "./login-fallback";

/**
 * Always render the login form immediately.
 * Do not touch the DB or validate sessions here — a stale cookie + slow DB
 * was making localhost appear "stuck" for 10–120s. Dashboard layout clears
 * invalid sessions when a protected route is hit.
 */
export default function Page() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPage />
    </Suspense>
  );
}
