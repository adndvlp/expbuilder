import { useState } from "react";
import useTrials from "../../../hooks/useTrials";
import { generateUniqueName } from "../utils/trialUtils";

export function useCanvasLoopActions(trials: ReturnType<typeof useTrials>) {
  const {
    timeline,
    setSelectedTrial,
    setSelectedLoop,
    createTrial,
    createLoop,
    getLoop,
    updateTimeline,
    getLoopTimeline,
  } = trials;
  const [showLoopModal, setShowLoopModal] = useState(false);
  const [openLoop, setOpenLoop] = useState<any>(null);

  const onAddTrial = async (type: string) => {
    // Generate unique name based on timeline
    const existingNames = timeline.map((item) => item.name);
    const newName = generateUniqueName(existingNames);

    try {
      const newTrial = await createTrial({
        type: type,
        name: newName,
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
      });

      // Optimistic UI: add the trial to the timeline manually
      updateTimeline([
        ...timeline,
        {
          id: newTrial.id,
          type: "trial",
          name: newTrial.name,
          branches: newTrial.branches || [],
        },
      ]);

      setSelectedTrial(newTrial);
      setSelectedLoop(null);
    } catch (error) {
      console.error("Error creating trial:", error);
    }
  };

  const handleCreateLoop = () => {
    const confirmed = window.confirm(
      "Are you sure you want to group these trials/loops into a loop?",
    );
    if (!confirmed) {
      return;
    }

    // Show modal to select range
    setShowLoopModal(true);
  };

  const handleAddLoop = async (itemIds: (number | string)[]) => {
    if (itemIds.length < 1) {
      alert("You must select at least 1 trial/loop to create a loop.");
      setShowLoopModal(false);
      return;
    }

    try {
      // Count existing loops to generate name
      const loopCount = timeline.filter((item) => item.type === "loop").length;
      const loopName = `Loop ${loopCount + 1}`;

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
        trials: itemIds, // Only IDs
        code: "",
      });

      setSelectedLoop(newLoop);
      setSelectedTrial(null);
      setShowLoopModal(false);
    } catch (error) {
      console.error("Error creating loop:", error);
      setShowLoopModal(false);
    }
  };

  // Load full loop and metadata when opened
  const handleOpenLoop = async (loopId: string) => {
    try {
      const loopData = await getLoop(loopId);
      await getLoopTimeline(loopId);

      if (loopData) {
        setOpenLoop(loopData);
      }
    } catch (error) {
      console.error("Error loading loop:", error);
    }
  };

  // Reload metadata of the open loop
  const handleRefreshLoopMetadata = async () => {
    /* v8 ignore start */
    if (!openLoop) return;
    /* v8 ignore stop */
    try {
      await getLoopTimeline(openLoop.id, true, true);
    } catch (error) {
      console.error("Error refreshing loop metadata:", error);
    }
  };

  return {
    showLoopModal,
    setShowLoopModal,
    openLoop,
    setOpenLoop,
    onAddTrial,
    handleCreateLoop,
    handleAddLoop,
    handleOpenLoop,
    handleRefreshLoopMetadata,
  };
}
