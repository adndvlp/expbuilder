import { useCallback, useEffect, useMemo, useState } from "react";
import type { TimelineItem } from "../../../contexts/TrialsContext";
import useTrials from "../../../hooks/useTrials";
import type { CanvasActionScope } from "../actions";
import { useCanvasBranchActions } from "./useCanvasBranchActions";
import { useCanvasLoopActions } from "./useCanvasLoopActions";
import { useCanvasMoveActions } from "./useCanvasMoveActions";
import { useExpandedLoopPath } from "./useExpandedLoopPath";
import type { LoopScopeId } from "./useExpandedLoopPath";
import { useFlowLayout } from "./useFlowLayout";

const scopesMatch = (
  left: LoopScopeId | null | undefined,
  right: LoopScopeId | null | undefined,
) =>
  left == null && right == null
    ? true
    : left != null && right != null && String(left) === String(right);

const resolveRequestedScope = (
  requested: LoopScopeId | null | undefined,
  active: LoopScopeId | null,
) => (requested === undefined ? active : requested);

export function useCanvasWorkspace() {
  const trials = useTrials();
  const {
    timeline,
    loopTimeline,
    activeLoopId,
    selectedTrial,
    selectedLoop,
    setSelectedTrial,
    setSelectedLoop,
    getTrial,
    getLoop,
    getLoopTimeline,
    clearLoopTimeline,
  } = trials;
  const [selectedScopeId, setSelectedScopeId] =
    useState<LoopScopeId | null>(null);
  const [showBranchedModal, setShowBranchedModal] = useState(false);
  const loadLoopItems = useCallback(
    (loopId: LoopScopeId, options: { forceRefresh: boolean }) =>
      getLoopTimeline(loopId, true, options.forceRefresh, true),
    [getLoopTimeline],
  );
  const activateRoot = useCallback(() => {
    clearLoopTimeline?.();
  }, [clearLoopTimeline]);
  const expanded = useExpandedLoopPath({ loadLoopItems, activateRoot });
  const {
    activeScopeId,
    activeEntry,
    activateScope: activateExpandedScope,
    collapseLoop,
    error,
    expandLoop,
    expandedPath,
    pending,
    reconcilePath,
    refreshLoop,
    syncActiveItems,
  } = expanded;

  useEffect(() => {
    const reconciliation = reconcilePath(timeline);
    if (reconciliation.activeScopeChanged) {
      void activateExpandedScope(reconciliation.activeScopeId);
    }
  }, [activateExpandedScope, expandedPath, reconcilePath, timeline]);

  useEffect(() => {
    if (activeScopeId !== null && scopesMatch(activeLoopId, activeScopeId)) {
      syncActiveItems(loopTimeline);
    }
  }, [activeLoopId, activeScopeId, loopTimeline, syncActiveItems]);

  useEffect(() => {
    if (error) console.error("Error loading loop:", error.cause);
  }, [error]);

  const actionScope = useMemo<CanvasActionScope>(() => {
    if (activeScopeId === null) return { kind: "root", items: timeline };
    return {
      kind: "loop",
      loopId: activeScopeId,
      items: activeEntry?.items ?? [],
      rootItems: timeline,
      refresh: async () => {
        await refreshLoop(activeScopeId);
      },
    };
  }, [activeEntry, activeScopeId, refreshLoop, timeline]);
  const loopActions = useCanvasLoopActions(trials, actionScope);
  const branchActions = useCanvasBranchActions(trials, actionScope);
  const moveActions = useCanvasMoveActions(trials, actionScope);
  const selectedItem = selectedTrial ?? selectedLoop;
  const hasSelection =
    selectedItem !== null && scopesMatch(selectedScopeId, activeScopeId);

  const clearSelection = useCallback(() => {
    setSelectedTrial(null);
    setSelectedLoop(null);
  }, [setSelectedLoop, setSelectedTrial]);

  const activateScope = useCallback(
    async (scopeId: LoopScopeId | null) => {
      clearSelection();
      setSelectedScopeId(scopeId);
      if (scopesMatch(scopeId, activeScopeId)) return true;
      return activateExpandedScope(scopeId);
    },
    [activateExpandedScope, activeScopeId, clearSelection],
  );

  const selectTrial = useCallback(
    async (trial: TimelineItem, requested?: LoopScopeId | null) => {
      const scopeId = resolveRequestedScope(requested, activeScopeId);
      if (!scopesMatch(scopeId, activeScopeId)) {
        const activated = await activateExpandedScope(scopeId);
        if (!activated) return;
      }
      setSelectedScopeId(scopeId);
      try {
        const fullTrial = await getTrial(trial.id);
        if (fullTrial) setSelectedTrial(fullTrial);
      } catch (selectionError: unknown) {
        console.error("Error fetching full trial data:", selectionError);
      }
      setSelectedLoop(null);
    },
    [
      activateExpandedScope,
      activeScopeId,
      getTrial,
      setSelectedLoop,
      setSelectedTrial,
    ],
  );

  const selectLoop = useCallback(
    async (loop: TimelineItem, requested?: LoopScopeId | null) => {
      const scopeId = resolveRequestedScope(requested, activeScopeId);
      if (!scopesMatch(scopeId, activeScopeId)) {
        const activated = await activateExpandedScope(scopeId);
        if (!activated) return;
      }
      setSelectedScopeId(scopeId);
      try {
        const fullLoop = await getLoop(loop.id);
        if (fullLoop) setSelectedLoop(fullLoop);
      } catch (selectionError: unknown) {
        console.error("Error fetching full loop data:", selectionError);
      }
      setSelectedTrial(null);
    },
    [
      activateExpandedScope,
      activeScopeId,
      getLoop,
      setSelectedLoop,
      setSelectedTrial,
    ],
  );

  const toggleLoop = useCallback(
    async (loop: TimelineItem, requested?: LoopScopeId | null) => {
      const parentScopeId = resolveRequestedScope(requested, activeScopeId);
      clearSelection();
      setSelectedScopeId(null);
      const isExpanded = expandedPath.some(
        (entry) =>
          scopesMatch(entry.loop.id, loop.id) &&
          scopesMatch(entry.loop.parentLoopId, parentScopeId),
      );
      if (isExpanded) await collapseLoop(loop.id);
      else {
        await expandLoop(
          { id: loop.id, name: loop.name },
          parentScopeId,
        );
      }
    },
    [activeScopeId, clearSelection, collapseLoop, expandLoop, expandedPath],
  );

  const { onAddBranch } = branchActions;
  const addBranch = useCallback(
    (itemId: string | number, scopeId?: LoopScopeId | null) => {
      if (!scopesMatch(scopeId, activeScopeId)) return;
      void onAddBranch(itemId);
    },
    [activeScopeId, onAddBranch],
  );
  const flow = useFlowLayout({
    timeline,
    expandedPath,
    selectedItemId: hasSelection ? (selectedItem?.id ?? null) : null,
    selectedScopeId,
    pendingLoopId: pending?.scopeId,
    onSelectTrial: selectTrial,
    onSelectLoop: selectLoop,
    onToggleLoop: toggleLoop,
    onAddBranch: addBranch,
  });

  const { handleAddLoop } = loopActions;
  const addLoop = useCallback(
    async (itemIds: Array<string | number>) => {
      const loop = await handleAddLoop(itemIds);
      if (loop) setSelectedScopeId(activeScopeId);
    },
    [activeScopeId, handleAddLoop],
  );

  return {
    trials,
    ...flow,
    expanded,
    actionScope,
    selectedItem,
    hasSelection,
    loopActions: { ...loopActions, handleAddLoop: addLoop },
    branchActions,
    moveActions,
    showBranchedModal,
    setShowBranchedModal,
    activateScope,
    clearSelection,
  };
}
