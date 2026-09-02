import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import TrialsContext, {
  type TimelineItem,
  type TrialsContextType,
} from "../../contexts/TrialsContext";
import type { Loop, Trial } from "../../components/ConfigurationPanel/types";
import { useExperimentID } from "../../hooks/useExperimentID";
import useTrialMethods from "./TrialMethods";
import useLoopMethods from "./LoopMethods";
import useLoopTimelineCache from "./hooks/useLoopTimelineCache";
import { createStateStore } from "./stateStore";
import { useExperimentGraphState } from "../../modules/experiment-graph/useExperimentGraphState";
import { experimentAuthoringClient } from "../../modules/experiment-authoring";

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [selectedTrial, setSelectedTrialState] = useState<Trial | null>(null);
  const [selectedLoop, setSelectedLoopState] = useState<Loop | null>(null);
  const trialSelection = useMemo(
    () => createStateStore<Trial | null>(null),
    [],
  );
  const loopSelection = useMemo(
    () => createStateStore<Loop | null>(null),
    [],
  );

  const experimentID = useExperimentID();

  const setSelectedTrial = useCallback<
    TrialsContextType["setSelectedTrial"]
  >((nextSelection) => {
    const next = trialSelection.resolve(nextSelection);
    setSelectedTrialState(next);
  }, [trialSelection]);
  const setSelectedLoop = useCallback<TrialsContextType["setSelectedLoop"]>(
    (nextSelection) => {
      const next = loopSelection.resolve(nextSelection);
      setSelectedLoopState(next);
    },
    [loopSelection],
  );
  const getSelectedTrial = trialSelection.get;
  const getSelectedLoop = loopSelection.get;

  const {
    loopTimeline,
    loopTimelineCache,
    activeLoopId,
    getLoopTimeline,
    activateLoopTimeline,
    clearLoopTimeline,
    updateLoopTimelineItems,
    replaceLoopTimelines,
    resetLoopTimelineCache,
  } = useLoopTimelineCache(experimentID);
  const {
    graph,
    timeline,
    isLoading,
    setTimeline,
    applyGraphSnapshot,
    getTimeline,
    clearGraph,
  } = useExperimentGraphState(experimentID, replaceLoopTimelines);

  const { createTrial, getTrial, updateTrial, updateTrialField, deleteTrial } =
    useTrialMethods({
      getSelectedTrial,
      experimentID,
      timeline,
      loopTimelineCache,
      setTimeline,
      updateLoopTimelineItems,
      getTimeline,
      applyGraphSnapshot,
      getLoopTimeline,
      setSelectedTrial,
    });

  const { createLoop, getLoop, updateLoop, updateLoopField, deleteLoop } =
    useLoopMethods({
      experimentID,
      timeline,
      loopTimelineCache,
      setTimeline,
      updateLoopTimelineItems,
      getTimeline,
      applyGraphSnapshot,
      getLoopTimeline,
      selectedLoop,
      setSelectedLoop,
      getSelectedLoop,
    });

  // ==================== TIMELINE METHODS ====================

  const updateTimeline = useCallback(
    async (newTimeline: TimelineItem[]): Promise<boolean> => {
      try {
        const data = await experimentAuthoringClient.updateTimeline(
          experimentID,
          newTimeline,
        );
        applyGraphSnapshot(data.graph);

        return true;
      } catch (error) {
        console.error("Error updating timeline:", error);
        return false;
      }
    },
    [applyGraphSnapshot, experimentID],
  );

  // ==================== DELETE ALL ====================

  const deleteAllTrials = useCallback(async (): Promise<boolean> => {
    try {
      await experimentAuthoringClient.deleteAllTrials(experimentID);

      // Limpiar estado local
      clearGraph();
      setSelectedTrial(null);
      setSelectedLoop(null);
      resetLoopTimelineCache();

      return true;
    } catch (error) {
      console.error("Error deleting all trials:", error);
      return false;
    }
  }, [
    experimentID,
    clearGraph,
    resetLoopTimelineCache,
    setSelectedLoop,
    setSelectedTrial,
  ]);

  // ==================== INITIAL LOAD ====================

  useEffect(() => {
    if (experimentID) {
      // The experiment ID is an external route input; entering a cold builder
      // must fetch its timeline once after the route commits.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void getTimeline();
    }
  }, [experimentID, getTimeline]);

  const contextValue = useMemo<TrialsContextType>(
    () => ({
      timeline,
      graph,
      applyGraphSnapshot,
      loopTimeline,
      loopTimelineCache,
      activeLoopId,
      selectedTrial,
      setSelectedTrial,
      selectedLoop,
      setSelectedLoop,
      createTrial,
      getTrial,
      updateTrial,
      updateTrialField,
      deleteTrial,
      createLoop,
      getLoop,
      updateLoop,
      updateLoopField,
      deleteLoop,
      updateTimeline,
      getTimeline,
      getLoopTimeline,
      activateLoopTimeline,
      clearLoopTimeline,
      deleteAllTrials,
      isLoading,
    }),
    [
      activeLoopId,
      activateLoopTimeline,
      applyGraphSnapshot,
      clearLoopTimeline,
      createLoop,
      createTrial,
      deleteAllTrials,
      deleteLoop,
      deleteTrial,
      getLoop,
      getLoopTimeline,
      getTimeline,
      getTrial,
      graph,
      isLoading,
      loopTimeline,
      loopTimelineCache,
      selectedLoop,
      setSelectedLoop,
      setSelectedTrial,
      selectedTrial,
      timeline,
      updateLoop,
      updateLoopField,
      updateTimeline,
      updateTrial,
      updateTrialField,
    ],
  );

  return (
    <TrialsContext.Provider value={contextValue}>
      {children}
    </TrialsContext.Provider>
  );
}
