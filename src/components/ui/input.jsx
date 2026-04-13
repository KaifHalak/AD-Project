import { cn } from "@/lib/utils";

/**
 * Simple shadcn-style input component.
 * Keeps consistent border, spacing, and focus state.
 */
export function Input({ className, type = "text", ...props }) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-xl border border-border-light bg-white px-3 text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}
