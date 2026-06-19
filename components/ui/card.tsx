import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn("ui-card", interactive && "ui-card--interactive", className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(className)}
      style={{ marginBottom: "var(--space-5)" }}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(className)}
      style={{
        margin: 0,
        fontSize: "var(--text-md)",
        fontWeight: "var(--weight-semibold)",
        color: "var(--color-text-primary)",
      }}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(className)}
      style={{
        margin: "var(--space-1) 0 0",
        fontSize: "var(--text-sm)",
        color: "var(--color-text-secondary)",
      }}
      {...props}
    />
  );
}
