export const own = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);
export const last = <T>(values: readonly T[]): T | undefined =>
  values[values.length - 1];
export function required<T>(
  value: T | null | undefined,
  message = "Workspace item not found",
): T {
  if (value == null) throw Error(message);
  return value;
}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const hasId = (
  ids: ReadonlySet<string>,
  id: string | null | undefined,
): id is string => id != null && ids.has(id);
