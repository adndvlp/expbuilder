import { useCallback, useMemo, useState } from "react";
import useTrials from "../../../hooks/useTrials";
import type { Trial } from "../../ConfigurationPanel/types";
import {
  addScopedBranchTrial,
  addScopedParentTrial,
} from "../actions";
import type {
  CanvasActionDependencies,
  CanvasActionScope,
} from "../actions";

export function useCanvasBranchActions(
  trials: ReturnType<typeof useTrials>,
  actionScope?: CanvasActionScope,
) {
  const [showAddTrialModal, setShowAddTrialModal] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<
    string | number | null
  >(null);
  const { setSelectedLoop, setSelectedTrial } = trials;
  const scope = useMemo<CanvasActionScope>(
    () =>
      actionScope ?? {
        kind: "root",
        items: trials.timeline,
      },
    [actionScope, trials.timeline],
  );
  const dependencies = useMemo<CanvasActionDependencies>(
    () => ({
      createTrial: trials.createTrial,
      createLoop: trials.createLoop,
      getTrial: trials.getTrial,
      getLoop: trials.getLoop,
      updateTrial: trials.updateTrial,
      updateLoop: trials.updateLoop,
      updateTrialField: trials.updateTrialField,
      updateTimeline: trials.updateTimeline,
    }),
    [
      trials.createLoop,
      trials.createTrial,
      trials.getLoop,
      trials.getTrial,
      trials.updateLoop,
      trials.updateTimeline,
      trials.updateTrial,
      trials.updateTrialField,
    ],
  );

  const selectTrial = useCallback(
    (trial: Trial) => {
      setSelectedTrial(trial);
      setSelectedLoop(null);
    },
    [setSelectedLoop, setSelectedTrial],
  );

  const addBranch = useCallback(
    (parentId: string | number) =>
      addScopedBranchTrial({
        scope,
        dependencies,
        parentId,
        onSelectTrial: selectTrial,
      }),
    [dependencies, scope, selectTrial],
  );

  const addParent = useCallback(
    (parentId: string | number) =>
      addScopedParentTrial({
        scope,
        dependencies,
        parentId,
        onSelectTrial: selectTrial,
      }),
    [dependencies, scope, selectTrial],
  );

  const onAddBranch = useCallback(
    async (parentId: string | number) => {
      const parent = scope.items.find((item) => item.id === parentId);
      if (!parent) return;
      if ((parent.branches ?? []).length === 0) {
        try {
          await addBranch(parentId);
        } catch (error: unknown) {
          console.error("Error adding branch:", error);
        }
        return;
      }
      setPendingParentId(parentId);
      setShowAddTrialModal(true);
    },
    [addBranch, scope.items],
  );

  const handleAddTrialConfirm = useCallback(
    async (addAsBranch: boolean) => {
      if (pendingParentId === null) return;
      setShowAddTrialModal(false);
      try {
        if (addAsBranch) await addBranch(pendingParentId);
        else await addParent(pendingParentId);
      } catch (error: unknown) {
        console.error(
          addAsBranch
            ? "Error adding branch:"
            : "Error adding trial as parent:",
          error,
        );
      } finally {
        setPendingParentId(null);
      }
    },
    [addBranch, addParent, pendingParentId],
  );

  return {
    showAddTrialModal,
    setShowAddTrialModal,
    pendingParentId,
    setPendingParentId,
    onAddBranch,
    handleAddTrialConfirm,
  };
}
