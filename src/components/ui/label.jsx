import { cn } from "@/lib/utils";

/**
 * Simple shadcn-style label component.
 * Used for form field labels.
 */
export function Label({ className, children, ...props }) {
  return (
    <label
      className={cn("text-sm font-medium text-text-main", className)}
      {...props}
    >
      {children}
    </label>
  );
}
