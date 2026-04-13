/**
 * Full-screen loader overlay used while pages or data are loading.
 * It covers the entire viewport and shows a simple spinning indicator.
 */
export default function Loader({ text = "Loading..." }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background-main/95"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-light bg-white px-8 py-6 shadow-sm">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border-light border-t-primary" />
        <p className="text-sm font-medium text-text-muted">{text}</p>
      </div>
    </div>
  );
}
