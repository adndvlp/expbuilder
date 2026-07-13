import { useState } from "react";
import useTrials from "../../../hooks/useTrials";
import { generateUniqueName } from "../utils/trialUtils";

export function useCanvasBranchActions(trials: ReturnType<typeof useTrials>) {
  const {
    timeline,
    createTrial,
    getTrial,
    getLoop,
    updateTrial,
    updateLoop,
    updateTimeline,
    setSelectedTrial,
  } = trials;
  const [showAddTrialModal, setShowAddTrialModal] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<
    number | string | null
  >(null);

  const onAddBranch = async (parentId: number | string) => {
    // Check if the parent has branches
    const parentItem = timeline.find((item) => item.id === parentId);
    if (!parentItem) return;

    const parentBranches = parentItem.branches || [];

    // If it has no branches, add directly as branch
    if (parentBranches.length === 0) {
      await addTrialAsBranch(parentId);
      return;
    }

    // If it has branches, show modal to ask
    setPendingParentId(parentId);
    setShowAddTrialModal(true);
  };

  // Add trial as branch (sibling)
  const addTrialAsBranch = async (parentId: number | string) => {
    const existingNames = timeline.map((item) => item.name);
    const newName = generateUniqueName(existingNames);

    try {
      // First get the parent
      const parentItem = timeline.find((item) => item.id === parentId);
      /* v8 ignore start */
      if (!parentItem) return;
      /* v8 ignore stop */

      // Create the trial
      const newBranchTrial = await createTrial({
        type: "Trial",
        name: newName,
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
      });

      // Get updated parent
      const parent =
        parentItem.type === "trial"
          ? await getTrial(parentId)
          : await getLoop(parentId);

      if (!parent) return;

      // Update the parent with the new branch
      // updateTrial/updateLoop will do the full optimistic UI
      if (parentItem.type === "trial") {
        await updateTrial(
          parentId,
          {
            branches: [...(parent.branches || []), newBranchTrial.id],
          },
          newBranchTrial,
        );
      } else {
        await updateLoop(
          parentId,
          {
            branches: [...(parent.branches || []), newBranchTrial.id],
          },
          newBranchTrial,
        );
      }

      setSelectedTrial(newBranchTrial);
    } catch (error) {
      console.error("Error adding branch:", error);
    }
  };

  // Add trial as parent (of the existing branches)
  const addTrialAsParent = async (parentId: number | string) => {
    const existingNames = timeline.map((item) => item.name);
    const newName = generateUniqueName(existingNames);

    try {
      // Get the parent to access its branches
      const parentItem = timeline.find((item) => item.id === parentId);
      /* v8 ignore start */
      if (!parentItem) return;
      /* v8 ignore stop */

      let parentBranches: (number | string)[] = [];

      if (parentItem.type === "trial") {
        const parentTrial = await getTrial(parentId);
        if (parentTrial) {
          parentBranches = parentTrial.branches || [];
        }
      } else {
        const parentLoop = await getLoop(parentId);
        if (parentLoop) {
          parentBranches = parentLoop.branches || [];
        }
      }

      // Create the new trial that will be the parent of the branches
      const newParentTrial = await createTrial({
        type: "Trial",
        name: newName,
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        branches: parentBranches, // The new trial becomes the parent of the existing branches
      });

      // Update the original parent to point to the new trial instead of the branches
      if (parentItem.type === "trial") {
        await updateTrial(
          parentId,
          {
            branches: [newParentTrial.id], // Now only points to the new trial
          },
          newParentTrial,
        );
      } else {
        await updateLoop(
          parentId,
          {
            branches: [newParentTrial.id], // Now only points to the new trial
          },
          newParentTrial,
        );
      }

      // Reorder timeline: insert new trial right after the parent
      const newTimeline = timeline
        .map((item) =>
          item.id === parentId
            ? { ...item, branches: [newParentTrial.id] }
            : item,
        )
        .filter((item) => item.id !== newParentTrial.id); // Remove if already appended

      const parentIndex = newTimeline.findIndex((item) => item.id === parentId);
      const insertIndex =
        parentIndex !== -1 ? parentIndex + 1 : newTimeline.length;
      newTimeline.splice(insertIndex, 0, {
        id: newParentTrial.id,
        type: "trial",
        name: newParentTrial.name,
        branches: newParentTrial.branches || [],
      });

      await updateTimeline(newTimeline);

      setSelectedTrial(newParentTrial);
    } catch (error) {
      console.error("Error adding trial as parent:", error);
    }
  };

  // Handler when the user confirms in the modal
  const handleAddTrialConfirm = async (addAsBranch: boolean) => {
    /* v8 ignore start */
    if (pendingParentId === null) return;
    /* v8 ignore stop */

    setShowAddTrialModal(false);

    if (addAsBranch) {
      await addTrialAsBranch(pendingParentId);
    } else {
      await addTrialAsParent(pendingParentId);
    }

    setPendingParentId(null);
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
