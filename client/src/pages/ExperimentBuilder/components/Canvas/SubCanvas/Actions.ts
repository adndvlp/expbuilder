import { generateUniqueName } from "../utils/trialUtils";
import { Loop, Trial } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { SetStateAction } from "react";

type Props = {
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: Loop) => void;
  onRefreshMetadata: (() => void) | undefined;
  loopTimeline: TimelineItem[];
  getTrial: (id: string | number) => Promise<Trial | null>;
  getLoop: (id: string | number) => Promise<Loop | null>;
  timeline: TimelineItem[];
  createTrial: (trial: Omit<Trial, "id">) => Promise<Trial>;
  updateLoop: (
    id: string | number,
    loop: Partial<Loop>,
    newBranchItem?: any,
  ) => Promise<Loop | null>;
  updateTrial: (
    id: string | number,
    trial: Partial<Trial>,
    newBranchTrial?: Trial,
  ) => Promise<Trial | null>;
  updateTrialField: (
    id: string | number,
    fieldName: string,
    value: any,
    updateSelectedTrial?: boolean,
  ) => Promise<boolean>;
  loopId: string | number;
  setShowLoopModal: (value: SetStateAction<boolean>) => void;
  createLoop: (loop: Omit<Loop, "id">) => Promise<Loop>;
  updateTimeline: (timeline: TimelineItem[]) => Promise<boolean>;
};

export default function Actions({
  onSelectTrial,
  onSelectLoop,
  onRefreshMetadata,
  getLoop,
  updateLoop,
  getTrial,
  updateTrial,
  updateTrialField,
  loopTimeline,
  timeline,
  loopId,
  createTrial,
  setShowLoopModal,
  createLoop,
  updateTimeline,
}: Props) {
  // Handler to show the add trial modal
  // Checks if the parent has branches before showing the modal
  const onAddBranch = async (parentId: number | string) => {
    // Check if the parent has branches
    const parentItem = loopTimeline.find((item) => item.id === parentId);
    if (!parentItem) return parentId;

    // If it has no branches, return parentId to handle directly
    // If it has branches, also return so the parent component handles the modal
    return parentId;
  };

  // Handler to add trial as branch (sibling)
  const addTrialAsBranch = async (parentId: number | string) => {
    // Get ALL existing names: from the main timeline + the current loop
    const timelineNames = timeline.map((item) => item.name);
    const loopTrialNames = loopTimeline.map((item) => item.name);
    const allNames = [...new Set([...timelineNames, ...loopTrialNames])];
    const newName = generateUniqueName(allNames);

    try {
      // Create the trial branch with parentLoopId so it is not added to the main timeline
      const newBranchTrial = await createTrial({
        type: "Trial",
        name: newName,
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        parentLoopId: String(loopId), // Importante: establece que este trial está dentro del loop
      });

      // Check if the parent loop has CSV and mark the trial accordingly
      const parentLoop = await getLoop(loopId);
      if (parentLoop && parentLoop.csvJson && parentLoop.csvJson.length > 0) {
        await updateTrialField(newBranchTrial.id, "csvFromLoop", true, false);
      }

      // Update the parent (trial or loop) to include this branch
      const parentItem = loopTimeline.find((item) => item.id === parentId);
      if (!parentItem) return;

      if (parentItem.type === "trial") {
        const parentTrial = await getTrial(parentId);
        if (parentTrial) {
          await updateTrial(
            parentId,
            {
              branches: [...(parentTrial.branches || []), newBranchTrial.id],
            },
            newBranchTrial, // Pass the newly created trial
          );
        }
      } else {
        const parentLoop = await getLoop(parentId);
        if (parentLoop) {
          await updateLoop(
            parentId,
            {
              branches: [...(parentLoop.branches || []), newBranchTrial.id],
            },
            newBranchTrial, // Pass the newly created trial
          );
        }
      }

      onSelectTrial(newBranchTrial);
    } catch (error) {
      console.error("Error adding branch:", error);
    }
  };

  // Handler to add trial as parent (of the existing branches)
  const addTrialAsParent = async (parentId: number | string) => {
    // Get ALL existing names: from the main timeline + the current loop
    const timelineNames = timeline.map((item) => item.name);
    const loopTrialNames = loopTimeline.map((item) => item.name);
    const allNames = [...new Set([...timelineNames, ...loopTrialNames])];
    const newName = generateUniqueName(allNames);

    try {
      // Get the parent to access its branches
      const parentItem = loopTimeline.find((item) => item.id === parentId);
      if (!parentItem) return;

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
        parentLoopId: String(loopId),
        branches: parentBranches, // The new trial becomes the parent of the existing branches
      });

      // Check if the parent loop has CSV and mark the trial accordingly
      const parentLoop = await getLoop(loopId);
      if (parentLoop && parentLoop.csvJson && parentLoop.csvJson.length > 0) {
        await updateTrialField(newParentTrial.id, "csvFromLoop", true, false);
      }

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

      const parentTimelineIndex = newTimeline.findIndex(
        (item) => item.id === parentId,
      );
      const insertIndex =
        parentTimelineIndex !== -1
          ? parentTimelineIndex + 1
          : newTimeline.length;
      newTimeline.splice(insertIndex, 0, {
        id: newParentTrial.id,
        type: "trial",
        name: newParentTrial.name,
        branches: newParentTrial.branches || [],
      });

      await updateTimeline(newTimeline);

      onSelectTrial(newParentTrial);
    } catch (error) {
      console.error("Error adding trial as parent:", error);
    }
  };

  // Handler to create nested loop
  const handleCreateNestedLoop = () => {
    const confirmed = window.confirm(
      "Are you sure you want to group these trials/loops into a nested loop?",
    );
    if (!confirmed) {
      return;
    }

    setShowLoopModal(true);
  };

  const handleAddLoop = async (itemIds: (number | string)[]) => {
    if (itemIds.length < 1) {
      alert("You must select at least 1 trial/loop to create a loop.");
      setShowLoopModal(false);
      return;
    }

    try {
      // Get the full parent loop to count nested loops
      const parentLoop = await getLoop(loopId);
      if (!parentLoop) return;

      // Get ALL existing names: from the main timeline + the current loop
      const timelineNames = timeline.map((item) => item.name);
      const loopTrialNames = loopTimeline.map((item) => item.name);
      const allNames = [...new Set([...timelineNames, ...loopTrialNames])];
      const loopName = generateUniqueName(allNames, "Nested Loop 1");

      const newLoop = await createLoop({
        name: loopName,
        repetitions: 1,
        randomize: false,
        orders: false,
        stimuliOrders: [],
        orderColumns: [],
        categoryColumn: "",
        categories: false,
        categoryData: [],
        trials: itemIds,
        code: "",
        parentLoopId: loopId, // Important: sets that this loop is inside the parent loop
      });

      // Update the parent loop to include the new nested loop
      const updatedTrials = [
        ...(parentLoop.trials || []).filter((id) => !itemIds.includes(id)),
        newLoop.id,
      ];

      await updateLoop(loopId, {
        trials: updatedTrials,
      });

      onSelectLoop(newLoop);
      setShowLoopModal(false);
      if (onRefreshMetadata) onRefreshMetadata();
    } catch (error) {
      console.error("Error creating nested loop:", error);
      setShowLoopModal(false);
    }
  };

  return {
    onAddBranch,
    addTrialAsBranch,
    addTrialAsParent,
    handleCreateNestedLoop,
    handleAddLoop,
  };
}
