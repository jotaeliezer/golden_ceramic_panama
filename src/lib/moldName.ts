/** Catalog name used when the capture form leaves the name blank. */
export function defaultMoldName(now = new Date()): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);
  return `New mold ${formatted}`;
}
