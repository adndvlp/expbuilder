import { useCallback, useRef, useState } from "react";
import type { TimelineItem } from "../../../contexts/TrialsContext";
import type {
  ExpandedLoopEntry,
  ExpandedLoopOperation,
  ExpandedLoopPathError,
  ExpandedLoopPending,
  ExpandedLoopReference,
  LoopScopeId,
  UseExpandedLoopPathOptions,
} from "./expandedLoopPathTypes";
import { reconcileExpandedLoopPath } from "./reconcileExpandedLoopPath";

export type {
  ExpandedLoopEntry,
  ExpandedLoopOperation,
  ExpandedLoopPathError,
  ExpandedLoopPending,
  ExpandedLoopReference,
  LoadLoopItems,
  LoadLoopItemsOptions,
  LoopScopeId,
  UseExpandedLoopPathOptions,
} from "./expandedLoopPathTypes";

type LoadResult =
  | { status: "loaded"; items: TimelineItem[] }
  | { status: "root" }
  | { status: "failed" };

const scopesMatch = (left: LoopScopeId | null, right: LoopScopeId | null) =>
  left === right ||
  (left !== null && right !== null && String(left) === String(right));

const findScopeIndex = (path: ExpandedLoopEntry[], scopeId: LoopScopeId) =>
  path.findIndex((entry) => scopesMatch(entry.loop.id, scopeId));

const withEntryItems = (
  path: ExpandedLoopEntry[],
  scopeId: LoopScopeId,
  items: TimelineItem[],
) => {
  const index = findScopeIndex(path, scopeId);
  if (index < 0) return path;

  const nextPath = [...path];
  nextPath[index] = { ...nextPath[index], items };
  return nextPath;
};

export function useExpandedLoopPath({
  loadLoopItems,
  activateRoot,
}: UseExpandedLoopPathOptions) {
  const [expandedPath, setExpandedPath] = useState<ExpandedLoopEntry[]>([]);
  const [activeScopeId, setActiveScopeId] = useState<LoopScopeId | null>(null);
  const [pending, setPending] = useState<ExpandedLoopPending | null>(null);
  const [error, setError] = useState<ExpandedLoopPathError | null>(null);
  const pathRef = useRef(expandedPath);
  const activeScopeRef = useRef(activeScopeId);
  const requestIdRef = useRef(0);

  const commitPath = useCallback((path: ExpandedLoopEntry[]) => {
    pathRef.current = path;
    setExpandedPath(path);
  }, []);

  const commitActiveScope = useCallback((scopeId: LoopScopeId | null) => {
    activeScopeRef.current = scopeId;
    setActiveScopeId(scopeId);
  }, []);

  const loadScope = useCallback(
    async (
      scopeId: LoopScopeId | null,
      operation: ExpandedLoopOperation,
      forceRefresh: boolean,
    ): Promise<LoadResult> => {
      const requestId = ++requestIdRef.current;
      setPending({ operation, scopeId });
      setError(null);

      try {
        if (scopeId === null) {
          await activateRoot?.();
          if (requestId !== requestIdRef.current) return { status: "failed" };
          setPending(null);
          return { status: "root" };
        }

        const items = await loadLoopItems(scopeId, { forceRefresh });
        if (requestId !== requestIdRef.current) return { status: "failed" };
        setPending(null);
        return { status: "loaded", items };
      } catch (cause: unknown) {
        if (requestId === requestIdRef.current) {
          setPending(null);
          setError({ operation, scopeId, cause });
        }
        return { status: "failed" };
      }
    },
    [activateRoot, loadLoopItems],
  );

  const reportMissingScope = useCallback(
    (operation: ExpandedLoopOperation, scopeId: LoopScopeId) => {
      setPending(null);
      setError({
        operation,
        scopeId,
        cause: new Error(`Loop scope ${String(scopeId)} is not expanded`),
      });
    },
    [],
  );

  const expandLoop = useCallback(
    async (
      loop: ExpandedLoopReference,
      parentLoopId: LoopScopeId | null = null,
    ) => {
      if (
        parentLoopId !== null &&
        findScopeIndex(pathRef.current, parentLoopId) < 0
      ) {
        reportMissingScope("expand", parentLoopId);
        return false;
      }

      const loaded = await loadScope(loop.id, "expand", false);
      if (loaded.status !== "loaded") return false;

      const currentPath = pathRef.current;
      const entry: ExpandedLoopEntry = {
        loop: { ...loop, parentLoopId },
        items: loaded.items,
      };

      if (parentLoopId === null) {
        commitPath([entry]);
      } else {
        const parentIndex = findScopeIndex(currentPath, parentLoopId);
        if (parentIndex < 0) return false;
        const existingIndex = findScopeIndex(currentPath, loop.id);

        if (existingIndex >= 0 && existingIndex <= parentIndex) {
          const nextPath = currentPath.slice(0, existingIndex + 1);
          nextPath[existingIndex] = {
            ...nextPath[existingIndex],
            items: loaded.items,
          };
          commitPath(nextPath);
        } else {
          commitPath([...currentPath.slice(0, parentIndex + 1), entry]);
        }
      }

      commitActiveScope(loop.id);
      return true;
    },
    [commitActiveScope, commitPath, loadScope, reportMissingScope],
  );

  const activateScope = useCallback(
    async (scopeId: LoopScopeId | null) => {
      if (scopeId !== null && findScopeIndex(pathRef.current, scopeId) < 0) {
        reportMissingScope("activate", scopeId);
        return false;
      }

      const loaded = await loadScope(scopeId, "activate", false);
      if (loaded.status === "failed") return false;
      if (loaded.status === "loaded" && scopeId !== null) {
        commitPath(withEntryItems(pathRef.current, scopeId, loaded.items));
      }
      commitActiveScope(scopeId);
      return true;
    },
    [commitActiveScope, commitPath, loadScope, reportMissingScope],
  );

  const collapseLoop = useCallback(
    async (scopeId: LoopScopeId) => {
      const initialIndex = findScopeIndex(pathRef.current, scopeId);
      if (initialIndex < 0) {
        reportMissingScope("collapse", scopeId);
        return false;
      }

      const parentId =
        initialIndex > 0 ? pathRef.current[initialIndex - 1].loop.id : null;
      const loaded = await loadScope(parentId, "collapse", false);
      if (loaded.status === "failed") return false;

      const currentIndex = findScopeIndex(pathRef.current, scopeId);
      if (currentIndex < 0) return false;
      let nextPath = pathRef.current.slice(0, currentIndex);
      if (loaded.status === "loaded" && parentId !== null) {
        nextPath = withEntryItems(nextPath, parentId, loaded.items);
      }
      commitPath(nextPath);
      commitActiveScope(parentId);
      return true;
    },
    [commitActiveScope, commitPath, loadScope, reportMissingScope],
  );

  const collapseAll = useCallback(async () => {
    const firstScope = pathRef.current[0]?.loop.id;
    if (firstScope !== undefined) return collapseLoop(firstScope);
    return activateScope(null);
  }, [activateScope, collapseLoop]);

  const refreshLoop = useCallback(
    async (scopeId: LoopScopeId | null = activeScopeRef.current) => {
      if (scopeId === null || findScopeIndex(pathRef.current, scopeId) < 0) {
        if (scopeId !== null) reportMissingScope("refresh", scopeId);
        return false;
      }

      const loaded = await loadScope(scopeId, "refresh", true);
      if (loaded.status !== "loaded") return false;
      commitPath(withEntryItems(pathRef.current, scopeId, loaded.items));
      commitActiveScope(scopeId);
      return true;
    },
    [commitActiveScope, commitPath, loadScope, reportMissingScope],
  );

  const syncLoopItems = useCallback(
    (scopeId: LoopScopeId, items: TimelineItem[]) => {
      if (findScopeIndex(pathRef.current, scopeId) < 0) return false;
      commitPath(withEntryItems(pathRef.current, scopeId, items));
      return true;
    },
    [commitPath],
  );

  const syncActiveItems = useCallback(
    (items: TimelineItem[]) => {
      if (activeScopeRef.current === null) return false;
      return syncLoopItems(activeScopeRef.current, items);
    },
    [syncLoopItems],
  );

  const reconcilePath = useCallback(
    (rootItems: TimelineItem[]) => {
      const result = reconcileExpandedLoopPath({
        path: pathRef.current,
        activeScopeId: activeScopeRef.current,
        rootItems,
      });
      if (result.pruned) {
        requestIdRef.current += 1;
        setPending(null);
        setError(null);
      }
      if (result.pathChanged) commitPath(result.path);
      if (result.activeScopeChanged) {
        commitActiveScope(result.activeScopeId);
      }
      return result;
    },
    [commitActiveScope, commitPath],
  );

  return {
    expandedPath,
    activeScopeId,
    activeEntry:
      activeScopeId === null
        ? null
        : (expandedPath.find((entry) =>
            scopesMatch(entry.loop.id, activeScopeId),
          ) ?? null),
    pending,
    isLoading: pending !== null,
    error,
    expandLoop,
    activateScope,
    collapseLoop,
    collapseAll,
    refreshLoop,
    syncLoopItems,
    syncActiveItems,
    reconcilePath,
    clearError: useCallback(() => setError(null), []),
  };
}
