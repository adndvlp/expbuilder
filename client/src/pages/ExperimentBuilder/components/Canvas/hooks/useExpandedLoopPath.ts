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
import {
  findScopeIndex,
  scopesMatch,
  withEntryItems,
} from "./expandedLoopPathUtils";
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
  | { status: "failed" };

export function useExpandedLoopPath({
  loadLoopItems,
  onActivateScope,
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
      scopeId: LoopScopeId,
      operation: ExpandedLoopOperation,
      forceRefresh: boolean,
    ): Promise<LoadResult> => {
      const requestId = ++requestIdRef.current;
      setPending({ operation, scopeId });
      setError(null);

      try {
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
    [loadLoopItems],
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

  const activateTarget = useCallback(
    async (
      scopeId: LoopScopeId | null,
      operation: ExpandedLoopOperation,
    ) => {
      const requestId = ++requestIdRef.current;
      setError(null);
      try {
        const activated = (await onActivateScope?.(scopeId)) ?? true;
        if (requestId !== requestIdRef.current) return false;
        if (!activated) {
          throw new Error(`Unable to activate loop scope ${String(scopeId)}`);
        }
        commitActiveScope(scopeId);
        return true;
      } catch (cause: unknown) {
        if (requestId === requestIdRef.current) {
          setError({ operation, scopeId, cause });
        }
        return false;
      }
    },
    [commitActiveScope, onActivateScope],
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
      if (!(await activateTarget(loop.id, "expand"))) return false;

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

      return true;
    },
    [activateTarget, commitPath, loadScope, reportMissingScope],
  );

  const activateScope = useCallback(
    async (scopeId: LoopScopeId | null) => {
      if (scopeId !== null && findScopeIndex(pathRef.current, scopeId) < 0) {
        reportMissingScope("activate", scopeId);
        return false;
      }

      return activateTarget(scopeId, "activate");
    },
    [activateTarget, reportMissingScope],
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
      if (!(await activateTarget(parentId, "collapse"))) return false;

      const currentIndex = findScopeIndex(pathRef.current, scopeId);
      if (currentIndex < 0) return false;
      commitPath(pathRef.current.slice(0, currentIndex));
      return true;
    },
    [activateTarget, commitPath, reportMissingScope],
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
      if (!(await activateTarget(scopeId, "refresh"))) return false;
      commitPath(withEntryItems(pathRef.current, scopeId, loaded.items));
      return true;
    },
    [activateTarget, commitPath, loadScope, reportMissingScope],
  );

  const syncLoopItems = useCallback(
    (scopeId: LoopScopeId, items: TimelineItem[]) => {
      if (findScopeIndex(pathRef.current, scopeId) < 0) return false;
      const nextPath = withEntryItems(pathRef.current, scopeId, items);
      if (nextPath !== pathRef.current) commitPath(nextPath);
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
        try {
          const activation = onActivateScope?.(result.activeScopeId);
          if (activation instanceof Promise) {
            void activation.catch(() => undefined);
          }
        } catch {
          // Reconciliation must not discard an otherwise valid cached path.
        }
      }
      return result;
    },
    [commitActiveScope, commitPath, onActivateScope],
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
