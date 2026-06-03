import { cn } from "@/lib/utils";

/**
 * Simple shadcn-style input component.
 * Keeps consistent border, spacing, and focus state.
 */
export function Input({ className, type = "text", ...props }) {
  const isReadOnly = Boolean(props.readOnly);

  if (isReadOnly) {
    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "h-11 w-full cursor-default rounded-xl border border-dashed border-border-light bg-background-main px-3 pr-24 text-text-muted outline-none transition-colors placeholder:text-text-muted focus:border-border-light",
            className,
          )}
          aria-readonly="true"
          {...props}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border-light bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Read only
        </span>
      </div>
    );
  }

  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-xl border border-border-light bg-white px-3 text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-primary disabled:cursor-not-allowed disabled:bg-background-main disabled:text-text-muted disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
