export function generateInitializeCode(customInitialize?: string): string {
  const trimmed = customInitialize?.trim() || "";
  if (!trimmed) return "";
  return `initialize: async function() {
      ${trimmed}
    },`;
}
