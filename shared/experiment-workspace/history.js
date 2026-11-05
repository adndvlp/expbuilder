const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (v, k) => Object.hasOwn(v, k);
const ignored = new Set(["authoringRevision", "updatedAt"]);

export function createDelta(before, after) {
  const changes = [];
  const field = (path, a, b, hasBefore, hasAfter) => {
    if (hasBefore === hasAfter && equal(a, b)) return;
    if (hasBefore && hasAfter && plain(a) && plain(b)) {
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
      const a = before[key] ?? [],
        b = after[key] ?? [],
        ids = new Set([...a, ...b].map((i) => String(i.id)));
      for (const id of ids) {
        const ia = a.findIndex((i) => String(i.id) === id),
          ib = b.findIndex((i) => String(i.id) === id),
          count = changes.length;
        field([key, id], a[ia], b[ib], ia >= 0, ib >= 0);
        if (changes.length > count && (ia < 0 || ib < 0))
          Object.assign(changes.at(-1), { indexBefore: ia, indexAfter: ib });
      }
    } else
      field([key], before[key], after[key], own(before, key), own(after, key));
  }
  return changes;
}

export function applyDelta(source, changes, direction = "undo") {
  const document = structuredClone(source),
    undo = direction === "undo";
  for (const change of undo ? [...changes].reverse() : changes) {
    const { path } = change,
      record = path.length >= 2 && ["trials", "loops"].includes(path[0]);
    let parent = document,
      keys = path;
    if (record) {
      const rows = document[path[0]],
        index = rows.findIndex((i) => String(i.id) === path[1]);
      if (path.length === 2) {
        parent = rows;
        keys = [index];
      } else {
        parent = rows[index];
        keys = path.slice(2);
      }
    }
    if (!parent)
      throw Object.assign(Error("Workspace history conflict"), {
        status: 409,
        code: "HISTORY_CONFLICT",
      });
    for (const key of keys.slice(0, -1)) {
      parent = parent[key];
      if (!parent)
        throw Object.assign(Error("Workspace history conflict"), {
          status: 409,
        });
    }
    const key = keys.at(-1),
      has = Array.isArray(parent) && Number(key) < 0 ? false : own(parent, key);
    const expectedHas = undo ? change.hasAfter : change.hasBefore,
      expected = undo ? change.after : change.before;
    if (has !== expectedHas || (has && !equal(parent[key], expected)))
      throw Object.assign(Error("Workspace history conflict"), {
        status: 409,
        code: "HISTORY_CONFLICT",
      });
    const nextHas = undo ? change.hasBefore : change.hasAfter,
      next = undo ? change.before : change.after;
    if (record && path.length === 2) {
      if (has) parent.splice(Number(key), 1);
      if (nextHas)
        parent.splice(
          Math.max(0, undo ? change.indexBefore : change.indexAfter),
          0,
          structuredClone(next),
        );
    } else if (nextHas) parent[key] = structuredClone(next);
    else delete parent[key];
  }
  return document;
}
