"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/primitives/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`[global-error] ${new Date().toISOString()}`, error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-full">
        <div className="login-page">
          <div className="login-card">
            <div className="login-card__head">
              <div className="login-card__logo">QA</div>
              <h1 className="login-card__title">Something went wrong</h1>
              <p className="login-card__subtitle">
                A critical error occurred. Please try again or sign in again.
              </p>
            </div>
            <div className="login-form" style={{ gap: "0.75rem" }}>
              <Button type="button" block onClick={() => reset()}>
                Try again
              </Button>
              <Link href="/login" className="ui-btn ui-btn--secondary ui-btn--block">
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
