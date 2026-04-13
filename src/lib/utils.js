/**
 * Joins class names while ignoring empty values.
 * This keeps conditional Tailwind class handling simple.
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
