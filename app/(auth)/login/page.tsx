import { Suspense } from "react";
import LoginPage from "./login-page";
import LoginFallback from "./login-fallback";

export default function Page() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPage />
    </Suspense>
  );
}
