import { cn } from "@/lib/utils";

/**
 * Simple shadcn-style card wrapper.
 * Provides the main panel styling for auth pages.
 */
export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "w-full max-w-xl rounded-3xl border-2 border-border-light bg-panel p-6 shadow-sm md:p-8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
