import type { TimelineItem } from "../../../contexts/TrialsContext";
import type {
  ExpandedLoopEntry,
  LoopScopeId,
} from "./expandedLoopPathTypes";

type ReconcileExpandedLoopPathInput = {
  path: ExpandedLoopEntry[];
  activeScopeId: LoopScopeId | null;
  rootItems: TimelineItem[];
};

type ReconcileExpandedLoopPathResult = {
  path: ExpandedLoopEntry[];
  activeScopeId: LoopScopeId | null;
  pathChanged: boolean;
  activeScopeChanged: boolean;
  pruned: boolean;
};

const idsMatch = (
  left: LoopScopeId | null | undefined,
  right: LoopScopeId | null | undefined,
) =>
  left == null && right == null
    ? true
    : left != null && right != null && String(left) === String(right);

export function reconcileExpandedLoopPath({
  path,
  activeScopeId,
  rootItems,
}: ReconcileExpandedLoopPathInput): ReconcileExpandedLoopPathResult {
  const nextPath: ExpandedLoopEntry[] = [];
  let parentItems = rootItems;

  for (const entry of path) {
    const visibleLoop = parentItems.find(
      (item) => item.type === "loop" && idsMatch(item.id, entry.loop.id),
    );
    if (!visibleLoop) break;

    const expectedParentId = nextPath.at(-1)?.loop.id ?? null;
    const loopChanged =
      visibleLoop.name !== entry.loop.name ||
      !idsMatch(entry.loop.parentLoopId, expectedParentId);
    nextPath.push(
      loopChanged
        ? {
            ...entry,
            loop: {
              ...entry.loop,
              name: visibleLoop.name,
              parentLoopId: expectedParentId,
            },
          }
        : entry,
    );
    parentItems = entry.items;
  }

  const activeStillVisible =
    activeScopeId === null ||
    nextPath.some((entry) => idsMatch(entry.loop.id, activeScopeId));
  const nextActiveScopeId = activeStillVisible
    ? activeScopeId
    : (nextPath.at(-1)?.loop.id ?? null);
  const pathChanged =
    nextPath.length !== path.length ||
    nextPath.some((entry, index) => entry !== path[index]);

  return {
    path: pathChanged ? nextPath : path,
    activeScopeId: nextActiveScopeId,
    pathChanged,
    activeScopeChanged: !idsMatch(nextActiveScopeId, activeScopeId),
    pruned: nextPath.length < path.length,
  };
}
