export function generateOnLoadCode(customOnLoad?: string): string {
  const trimmed = customOnLoad?.trim() || "";
  if (!trimmed) return "";
  return `on_load: function() {
      ${trimmed}
    },`;
}
