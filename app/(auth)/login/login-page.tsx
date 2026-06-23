"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label } from "@/components/primitives/field";

const initialState: LoginState = {};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const sessionReason = searchParams.get("reason");
  const sessionWasCleared =
    sessionReason === "session" ||
    sessionReason === "deactivated" ||
    sessionReason === "not_approved";
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  const sessionNotice =
    sessionReason === "session"
      ? "Your session expired or was signed out elsewhere. Please sign in again."
      : sessionReason === "deactivated"
        ? "This account was deactivated and your session was cleared. Sign in again after an administrator reactivates your account."
        : sessionReason === "not_approved"
          ? "Your account is not approved for login yet. Contact your Quality Manager."
          : null;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__head">
          <div className="login-card__logo">QA</div>
          <h1 className="login-card__title">Welcome back</h1>
          <p className="login-card__subtitle">
            Sign in to your Quality Audit account
          </p>
        </div>

        <form action={formAction} className="login-form">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          {sessionWasCleared ? (
            <input type="hidden" name="sessionWasCleared" value="1" />
          ) : null}

          {sessionNotice ? (
            <p role="status" className="ui-alert">
              {sessionNotice}
            </p>
          ) : null}

          {state.error && (
            <p role="alert" className="ui-alert">
              {state.error}
            </p>
          )}

          <Field>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={pending}
            />
          </Field>

          <Field>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
            />
          </Field>

          <Button type="submit" block loading={pending}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
