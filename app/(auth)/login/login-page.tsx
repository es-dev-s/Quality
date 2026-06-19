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
  const [state, formAction, pending] = useActionState(loginAction, initialState);

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
