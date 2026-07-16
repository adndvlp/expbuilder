import { useState } from "react";
import useTrials from "../../../hooks/useTrials";
import {
  createScopedLoop,
  createScopedTrial,
} from "../actions";
import type { CanvasActionScope } from "../actions";

export function useCanvasLoopActions(
  trials: ReturnType<typeof useTrials>,
  actionScope?: CanvasActionScope,
) {
  const [showLoopModal, setShowLoopModal] = useState(false);
  const scope: CanvasActionScope = actionScope ?? {
    kind: "root",
    items: trials.timeline,
  };

  const onAddTrial = async (trialType: string) => {
    try {
      const trial = await createScopedTrial({
        scope,
        dependencies: trials,
        trialType,
        onSelectTrial: (selected) => {
          trials.setSelectedTrial(selected);
          trials.setSelectedLoop(null);
        },
      });
      return trial;
    } catch (error: unknown) {
      console.error("Error creating trial:", error);
      return null;
    }
  };

  const handleCreateLoop = () => {
    const message =
      scope.kind === "root"
        ? "Are you sure you want to group these trials/loops into a loop?"
        : "Are you sure you want to group these trials/loops into a nested loop?";
    if (window.confirm(message)) setShowLoopModal(true);
  };

  const handleAddLoop = async (itemIds: Array<string | number>) => {
    if (itemIds.length < 1) {
      alert("You must select at least 1 trial/loop to create a loop.");
      setShowLoopModal(false);
      return null;
    }

    try {
      const loop = await createScopedLoop({
        scope,
        dependencies: trials,
        itemIds,
        onSelectLoop: (selected) => {
          trials.setSelectedLoop(selected);
          trials.setSelectedTrial(null);
        },
      });
      setShowLoopModal(false);
      return loop;
    } catch (error: unknown) {
      console.error("Error creating loop:", error);
      setShowLoopModal(false);
      return null;
    }
  };

  return {
    showLoopModal,
    setShowLoopModal,
    onAddTrial,
    handleCreateLoop,
    handleAddLoop,
  };
}
