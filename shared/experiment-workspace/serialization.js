export function stableStringify(value) {
  if (Array.isArray(value))
    return "[" + value.map((v) => stableStringify(v) ?? "null").join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .filter((k) => value[k] !== undefined)
        .map((k) => JSON.stringify(k) + ":" + stableStringify(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
