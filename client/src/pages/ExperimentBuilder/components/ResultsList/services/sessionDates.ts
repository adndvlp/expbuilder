export function sessionTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function formatSessionDate(value: string | undefined): string {
  const timestamp = sessionTimestamp(value);
  return timestamp > 0 ? new Date(timestamp).toLocaleString() : "Date unavailable";
}
