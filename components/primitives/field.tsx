import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export { Select } from "@/components/primitives/custom-select";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("ui-input", className)} {...props} />
  )
);

Input.displayName = "Input";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("ui-label", className)} {...props} />;
}

export function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-field", className)} {...props} />;
}
