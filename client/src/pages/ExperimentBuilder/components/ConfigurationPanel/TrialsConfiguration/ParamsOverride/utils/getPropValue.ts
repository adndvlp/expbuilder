export function getPropValue(prop: unknown): unknown {
  if (prop && typeof prop === "object" && "source" in prop && "value" in prop) {
    return (prop as { value: unknown }).value;
  }
  return prop;
}
