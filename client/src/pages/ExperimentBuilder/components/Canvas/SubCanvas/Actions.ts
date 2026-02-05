import { Connection } from "reactflow";
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
  loopId: string | number;
  setShowLoopModal: (value: SetStateAction<boolean>) => void;
  createLoop: (loop: Omit<Loop, "id">) => Promise<Loop>;
};

export default function Actions({
  onSelectTrial,
  onSelectLoop,
  onRefreshMetadata,
  getLoop,
  updateLoop,
  getTrial,
  updateTrial,
  loopTimeline,
  timeline,
  loopId,
  createTrial,
  setShowLoopModal,
  createLoop,
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
    if (itemIds.length < 2) {
      alert("You must select at least 2 trials/loops to create a loop.");
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

  // Handler to manually connect trials
  const handleConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // Extract node IDs
    const extractId = (nodeId: string): number | string | null => {
      if (nodeId.startsWith("loop-")) {
        return nodeId.substring(5);
      }
      const segments = nodeId.split("-");
      const lastSegment = segments[segments.length - 1];
      const parsed = parseInt(lastSegment);
      return isNaN(parsed) ? lastSegment : parsed;
    };

    const sourceId = extractId(connection.source);
    const targetId = extractId(connection.target);

    if (sourceId === null || targetId === null) {
      console.error("Invalid connection IDs");
      return;
    }

    try {
      // Find the source in loopTimeline
      const sourceItem = loopTimeline.find((item) => item.id === sourceId);
      if (!sourceItem) return;

      if (sourceItem.type === "trial") {
        const sourceTrial = await getTrial(sourceId);
        if (!sourceTrial) return;

        const branches = sourceTrial.branches || [];
        if (!branches.includes(targetId)) {
          await updateTrial(sourceId, {
            branches: [...branches, targetId],
          });
        }
      } else {
        const sourceLoop = await getLoop(sourceId);
        if (!sourceLoop) return;

        const branches = sourceLoop.branches || [];
        if (!branches.includes(targetId)) {
          await updateLoop(sourceId, {
            branches: [...branches, targetId],
          });
        }
      }

      if (onRefreshMetadata) onRefreshMetadata();
    } catch (error) {
      console.error("Error connecting items:", error);
    }
  };

  return {
    onAddBranch,
    addTrialAsBranch,
    addTrialAsParent,
    handleCreateNestedLoop,
    handleAddLoop,
    handleConnect,
  };
}
