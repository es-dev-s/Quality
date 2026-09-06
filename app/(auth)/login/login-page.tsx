"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
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
  const [passwordVisible, setPasswordVisible] = useState(false);

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
            <div className="password-field password-field--in-input">
              <Input
                id="password"
                name="password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={pending}
                className="password-field__input"
              />
              <button
                type="button"
                className="password-field__icon-btn"
                onClick={() => setPasswordVisible((visible) => !visible)}
                disabled={pending}
                aria-label={passwordVisible ? "Hide password" : "Show password"}
              >
                {passwordVisible ? (
                  <EyeOff size={16} aria-hidden />
                ) : (
                  <Eye size={16} aria-hidden />
                )}
              </button>
            </div>
          </Field>

          <Button type="submit" block loading={pending}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
