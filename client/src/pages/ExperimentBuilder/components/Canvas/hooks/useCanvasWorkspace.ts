import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    loopTimelineCache,
    selectedTrial,
    selectedLoop,
    setSelectedTrial,
    setSelectedLoop,
    getTrial,
    getLoop,
    getLoopTimeline,
    activateLoopTimeline,
  } = trials;
  const [selectedScopeId, setSelectedScopeId] =
    useState<LoopScopeId | null>(null);
  const [showBranchedModal, setShowBranchedModal] = useState(false);
  const selectionRequestRef = useRef(0);
  const loadLoopItems = useCallback(
    (loopId: LoopScopeId, options: { forceRefresh: boolean }) =>
      getLoopTimeline(loopId, {
        mode: "cache",
        forceRefresh: options.forceRefresh,
        throwOnError: true,
      }),
    [getLoopTimeline],
  );
  const onActivateScope = useCallback(
    (scopeId: LoopScopeId | null) => activateLoopTimeline(scopeId),
    [activateLoopTimeline],
  );
  const expanded = useExpandedLoopPath({
    loadLoopItems,
    onActivateScope,
  });
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
    syncLoopItems,
  } = expanded;

  useEffect(() => {
    let synchronized = false;
    expandedPath.forEach((entry) => {
      const cached = loopTimelineCache[String(entry.loop.id)];
      if (cached?.status === "ready" && cached.items !== entry.items) {
        synchronized = syncLoopItems(entry.loop.id, cached.items) || synchronized;
      }
    });
    if (!synchronized) {
      reconcilePath(timeline);
    }
  }, [
    expandedPath,
    loopTimelineCache,
    reconcilePath,
    syncLoopItems,
    timeline,
  ]);

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
    selectionRequestRef.current += 1;
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
      const requestId = ++selectionRequestRef.current;
      const scopeId = resolveRequestedScope(requested, activeScopeId);
      if (!scopesMatch(scopeId, activeScopeId)) {
        const activated = await activateExpandedScope(scopeId);
        if (!activated || requestId !== selectionRequestRef.current) return;
      }
      setSelectedScopeId(scopeId);
      try {
        const fullTrial = await getTrial(trial.id);
        if (requestId !== selectionRequestRef.current) return;
        if (fullTrial) setSelectedTrial(fullTrial);
      } catch (selectionError: unknown) {
        if (requestId !== selectionRequestRef.current) return;
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
      const requestId = ++selectionRequestRef.current;
      const scopeId = resolveRequestedScope(requested, activeScopeId);
      if (!scopesMatch(scopeId, activeScopeId)) {
        const activated = await activateExpandedScope(scopeId);
        if (!activated || requestId !== selectionRequestRef.current) return;
      }
      setSelectedScopeId(scopeId);
      try {
        const fullLoop = await getLoop(loop.id);
        if (requestId !== selectionRequestRef.current) return;
        if (fullLoop) setSelectedLoop(fullLoop);
      } catch (selectionError: unknown) {
        if (requestId !== selectionRequestRef.current) return;
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
