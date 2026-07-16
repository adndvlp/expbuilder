import { useState } from "react";
import useTrials from "../../../hooks/useTrials";
import {
  addScopedBranchTrial,
  addScopedParentTrial,
} from "../actions";
import type { CanvasActionScope } from "../actions";

export function useCanvasBranchActions(
  trials: ReturnType<typeof useTrials>,
  actionScope?: CanvasActionScope,
) {
  const [showAddTrialModal, setShowAddTrialModal] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<
    string | number | null
  >(null);
  const scope: CanvasActionScope = actionScope ?? {
    kind: "root",
    items: trials.timeline,
  };

  const selectTrial = (trial: Parameters<typeof trials.setSelectedTrial>[0]) => {
    trials.setSelectedTrial(trial);
    trials.setSelectedLoop(null);
  };

  const addBranch = async (parentId: string | number) =>
    addScopedBranchTrial({
      scope,
      dependencies: trials,
      parentId,
      onSelectTrial: selectTrial,
    });

  const addParent = async (parentId: string | number) =>
    addScopedParentTrial({
      scope,
      dependencies: trials,
      parentId,
      onSelectTrial: selectTrial,
    });

  const onAddBranch = async (parentId: string | number) => {
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
  };

  const handleAddTrialConfirm = async (addAsBranch: boolean) => {
    if (pendingParentId === null) return;
    setShowAddTrialModal(false);
    try {
      if (addAsBranch) await addBranch(pendingParentId);
      else await addParent(pendingParentId);
    } catch (error: unknown) {
      console.error(
        addAsBranch ? "Error adding branch:" : "Error adding trial as parent:",
        error,
      );
    } finally {
      setPendingParentId(null);
    }
  };

  return {
    showAddTrialModal,
    setShowAddTrialModal,
    pendingParentId,
    setPendingParentId,
    onAddBranch,
    handleAddTrialConfirm,
  };
}
