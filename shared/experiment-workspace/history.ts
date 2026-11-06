import type { Delta } from "./types.js";
import { isRecord, own, required, last } from "./valueUtils.js";
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const ignored = new Set(["authoringRevision", "updatedAt"]);
const read = (value: object, key: PropertyKey): unknown =>
  Reflect.get(value, key);
function container(value: unknown): object {
  if (value === null || typeof value !== "object")
    throw Object.assign(Error("Workspace history conflict"), {
      status: 409,
      code: "HISTORY_CONFLICT",
    });
  return value;
}
function rows(value: unknown): object[] {
  if (
    !Array.isArray(value) ||
    !value.every((row: unknown) => row !== null && typeof row === "object")
  )
    throw Object.assign(Error("Workspace history conflict"), {
      status: 409,
      code: "HISTORY_CONFLICT",
    });
  return value;
}
export function createDelta(before: object, after: object): Delta[] {
  const changes: Delta[] = [];
  const field = (
    path: Delta["path"],
    a: unknown,
    b: unknown,
    hasBefore: boolean,
    hasAfter: boolean,
  ): void => {
    if (hasBefore === hasAfter && equal(a, b)) return;
    if (hasBefore && hasAfter && isRecord(a) && isRecord(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
        field([...path, key], a[key], b[key], own(a, key), own(b, key));
    } else
      changes.push({
        path,
        hasBefore,
        hasAfter,
        ...(hasBefore ? { before: structuredClone(a) } : {}),
        ...(hasAfter ? { after: structuredClone(b) } : {}),
      });
  };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (ignored.has(key)) continue;
    if (key === "trials" || key === "loops") {
      const a = rows(read(before, key) ?? []),
        b = rows(read(after, key) ?? []);
      const ids = new Set([...a, ...b].map((item) => String(read(item, "id"))));
      for (const id of ids) {
        const ia = a.findIndex((item) => String(read(item, "id")) === id);
        const ib = b.findIndex((item) => String(read(item, "id")) === id),
          count = changes.length;
        field([key, id], a[ia], b[ib], ia >= 0, ib >= 0);
        if (changes.length > count && (ia < 0 || ib < 0))
          Object.assign(required(last(changes)), {
            indexBefore: ia,
            indexAfter: ib,
          });
      }
    } else
      field(
        [key],
        read(before, key),
        read(after, key),
        own(before, key),
        own(after, key),
      );
  }
  return changes;
}
export function applyDelta<T extends object>(
  source: T,
  changes: Delta[],
  direction: "undo" | "redo" = "undo",
): T {
  const document = structuredClone(source),
    undo = direction === "undo";
  for (const change of undo ? [...changes].reverse() : changes) {
    const { path } = change,
      record =
        path.length >= 2 && ["trials", "loops"].includes(String(path[0]));
    let parent: object = document,
      keys = path;
    if (record) {
      const records = rows(read(document, path[0]));
      const index = records.findIndex(
        (item) => String(read(item, "id")) === path[1],
      );
      if (path.length === 2) {
        parent = records;
        keys = [index];
      } else {
        parent = container(records[index]);
        keys = path.slice(2);
      }
    }
    for (const key of keys.slice(0, -1)) parent = container(read(parent, key));
    const key = required(last(keys));
    const has =
      Array.isArray(parent) && Number(key) < 0 ? false : own(parent, key);
    const expectedHas = undo ? change.hasAfter : change.hasBefore;
    const expected = undo ? change.after : change.before;
    if (has !== expectedHas || (has && !equal(read(parent, key), expected)))
      throw Object.assign(Error("Workspace history conflict"), {
        status: 409,
        code: "HISTORY_CONFLICT",
      });
    const nextHas = undo ? change.hasBefore : change.hasAfter,
      next = undo ? change.before : change.after;
    if (record && path.length === 2) {
      if (!Array.isArray(parent)) throw Error("Workspace history conflict");
      if (has) parent.splice(Number(key), 1);
      if (nextHas)
        parent.splice(
          Math.max(0, required(undo ? change.indexBefore : change.indexAfter)),
          0,
          structuredClone(next),
        );
    } else if (nextHas) Reflect.set(parent, key, structuredClone(next));
    else Reflect.deleteProperty(parent, key);
  }
  return document;
}
