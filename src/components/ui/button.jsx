import { cn } from "@/lib/utils";

/**
 * Simple shadcn-style button component.
 * Supports primary and secondary variants.
 */
export function Button({
  className,
  type = "button",
  variant = "default",
  disabled = false,
  children,
  ...props
}) {
  const variantClass =
    variant === "secondary"
      ? "bg-panel text-text-main border border-border-light hover:bg-background-main"
      : "bg-primary text-white hover:bg-primary-hover";

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variantClass,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
