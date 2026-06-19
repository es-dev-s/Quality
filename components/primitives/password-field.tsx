"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label } from "@/components/primitives/field";
import {
  generateClientPassword,
  passwordsMatch,
} from "@/lib/password-client";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
  id?: string;
  name?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  minLength?: number;
  hint?: string;
  showGenerator?: boolean;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
};

export function PasswordField({
  id: idProp,
  name = "password",
  label = "Password",
  required = false,
  disabled = false,
  minLength = 8,
  hint,
  showGenerator = true,
  autoComplete = "new-password",
  placeholder,
  value,
  onChange,
}: PasswordFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const [visible, setVisible] = useState(false);

  function handleGenerate() {
    onChange(generateClientPassword(12));
  }

  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <div className="password-field">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          disabled={disabled}
          minLength={required ? minLength : undefined}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="password-field__input"
        />
        <div className="password-field__actions">
          <button
            type="button"
            className="password-field__icon-btn"
            onClick={() => setVisible((current) => !current)}
            disabled={disabled}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
          {showGenerator ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={handleGenerate}
              className="password-field__generate"
            >
              <RefreshCw size={14} aria-hidden />
              Generate
            </Button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="ui-hint">{hint}</p> : null}
    </Field>
  );
}

type PasswordConfirmFieldProps = {
  id?: string;
  label?: string;
  password: string;
  required?: boolean;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
};

export function PasswordConfirmField({
  id: idProp,
  label = "Confirm password",
  password,
  required = true,
  disabled = false,
  value,
  onChange,
}: PasswordConfirmFieldProps) {
  const generatedId = useId();
  const id = idProp ?? `${generatedId}-confirm`;
  const [visible, setVisible] = useState(false);
  const mismatch = value.length > 0 && !passwordsMatch(password, value);

  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <div className="password-field">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          disabled={disabled}
          autoComplete="new-password"
          aria-invalid={mismatch}
          className={cn("password-field__input", mismatch && "password-field__input--invalid")}
        />
        <div className="password-field__actions">
          <button
            type="button"
            className="password-field__icon-btn"
            onClick={() => setVisible((current) => !current)}
            disabled={disabled}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
      </div>
      {mismatch ? (
        <p className="ui-hint ui-hint--error">Passwords do not match.</p>
      ) : (
        <p className="ui-hint">Re-enter the password to confirm.</p>
      )}
    </Field>
  );
}

export function isPasswordFormValid(
  password: string,
  confirm: string,
  options?: { required?: boolean; minLength?: number; requireConfirm?: boolean }
): boolean {
  const required = options?.required ?? true;
  const minLength = options?.minLength ?? 8;
  const requireConfirm = options?.requireConfirm ?? true;

  if (!required && password.length === 0) {
    return true;
  }

  if (password.length < minLength) {
    return false;
  }

  if (requireConfirm && !passwordsMatch(password, confirm)) {
    return false;
  }

  return true;
}
