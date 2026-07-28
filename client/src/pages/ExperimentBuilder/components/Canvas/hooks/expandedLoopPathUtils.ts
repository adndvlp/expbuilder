import type { TimelineItem } from "../../../contexts/TrialsContext";
import type {
  ExpandedLoopEntry,
  LoopScopeId,
} from "./expandedLoopPathTypes";

export const scopesMatch = (
  left: LoopScopeId | null,
  right: LoopScopeId | null,
) =>
  left === right ||
  (left !== null && right !== null && String(left) === String(right));

export const findScopeIndex = (
  path: ExpandedLoopEntry[],
  scopeId: LoopScopeId,
) => path.findIndex((entry) => scopesMatch(entry.loop.id, scopeId));

export const withEntryItems = (
  path: ExpandedLoopEntry[],
  scopeId: LoopScopeId,
  items: TimelineItem[],
) => {
  const index = findScopeIndex(path, scopeId);
  if (index < 0 || path[index].items === items) return path;

  const nextPath = [...path];
  nextPath[index] = { ...nextPath[index], items };
  return nextPath;
};
