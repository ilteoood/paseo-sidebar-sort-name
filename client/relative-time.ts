export function formatRelativeTime(value: string | null, now: number): string | null {
  if (value === null) return null;
  const elapsedMinutes = Math.floor((now - new Date(value).getTime()) / 60_000);
  if (!Number.isFinite(elapsedMinutes)) return null;
  if (elapsedMinutes < 1) return "now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7 ? `${elapsedDays}d` : `${Math.floor(elapsedDays / 7)}w`;
}
