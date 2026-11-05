export function workspaceRecords(document, ids) {
  const selected = new Set(ids),
    all = [...document.trials, ...document.loops];
  for (const id of selected)
    if (!all.some((i) => String(i.id) === id))
      throw Object.assign(Error("Requested workspace item no longer exists"), {
        status: 409,
        code: "REVISION_CONFLICT",
      });
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of all)
      if (
        item.parentLoopId != null &&
        selected.has(String(item.parentLoopId)) &&
        !selected.has(String(item.id))
      ) {
        selected.add(String(item.id));
        changed = true;
      }
  }
  return structuredClone(all.filter((i) => selected.has(String(i.id))));
}
