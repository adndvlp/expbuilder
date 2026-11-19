export function stableStringify(value: unknown): string | undefined {
  if (Array.isArray(value))
    return (
      "[" +
      value.map((v: unknown) => stableStringify(v) ?? "null").join(",") +
      "]"
    );
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => JSON.stringify(k) + ":" + stableStringify(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
