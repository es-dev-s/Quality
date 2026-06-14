import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const variantClass: Record<ButtonVariant, string> = {
  primary: "ui-btn--primary",
  secondary: "ui-btn--secondary",
  ghost: "ui-btn--ghost",
  danger: "ui-btn--danger",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "ui-btn--sm",
  md: "ui-btn--md",
  icon: "ui-btn--icon",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      block = false,
      type = "button",
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "ui-btn",
        variantClass[variant],
        sizeClass[size],
        block && "ui-btn--block",
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
