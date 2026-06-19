import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "accent";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  tone?: "neutral" | "accent";
  dot?: boolean;
};

const variantClass: Record<BadgeVariant, string> = {
  default: "",
  success: "ui-badge--success",
  warning: "ui-badge--warning",
  error: "ui-badge--danger",
  info: "ui-badge--accent",
  accent: "ui-badge--accent",
};

export function Badge({
  className,
  variant = "default",
  tone,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const resolved = tone === "accent" ? "accent" : variant;
  return (
    <span className={cn("ui-badge", variantClass[resolved], className)} {...props}>
      {dot ? <span className="ui-badge__dot" aria-hidden /> : null}
      {children}
    </span>
  );
}

export type { BadgeProps };
