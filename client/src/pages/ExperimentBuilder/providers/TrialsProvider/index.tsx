import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, SetStateAction } from "react";
import TrialsContext, {
  type TimelineItem,
  type TrialsContextType,
} from "../../contexts/TrialsContext";
import type { Loop, Trial } from "../../components/ConfigurationPanel/types";
import { useExperimentID } from "../../hooks/useExperimentID";
import TrialMethods from "./TrialMethods";
import LoopMethods from "./LoopMethods";
import useLoopTimelineCache from "./hooks/useLoopTimelineCache";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [timeline, setTimelineState] = useState<TimelineItem[]>([]);
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);
  const [selectedLoop, setSelectedLoop] = useState<Loop | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const experimentID = useExperimentID();
  const currentExperimentIdRef = useRef(experimentID);
  const timelineRequestVersionRef = useRef(0);
  currentExperimentIdRef.current = experimentID;

  const setTimeline = useCallback(
    (nextTimeline: SetStateAction<TimelineItem[]>) => {
      timelineRequestVersionRef.current += 1;
      setIsLoading(false);
      setTimelineState(nextTimeline);
    },
    [],
  );
  const {
    loopTimeline,
    loopTimelineCache,
    activeLoopId,
    getLoopTimeline,
    activateLoopTimeline,
    clearLoopTimeline,
    updateLoopTimelineItems,
    resetLoopTimelineCache,
  } = useLoopTimelineCache(experimentID);

  // ==================== TIMELINE METHODS ====================

  const getTimeline = useCallback(async () => {
    if (!experimentID) return;
    const requestedExperimentId = experimentID;
    const requestVersion = ++timelineRequestVersionRef.current;

    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_URL}/api/trials-metadata/${requestedExperimentId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load trials timeline");
      }

      const data = await response.json();

      if (
        requestVersion === timelineRequestVersionRef.current &&
        requestedExperimentId === currentExperimentIdRef.current
      ) {
        setTimelineState(data.timeline || []);
      }
    } catch (error) {
      console.error("Error loading trials timeline:", error);
    } finally {
      if (
        requestVersion === timelineRequestVersionRef.current &&
        requestedExperimentId === currentExperimentIdRef.current
      ) {
        setIsLoading(false);
      }
    }
  }, [experimentID]);

  const { createTrial, getTrial, updateTrial, updateTrialField, deleteTrial } =
    TrialMethods({
      selectedTrial,
      experimentID,
      timeline,
      loopTimelineCache,
      setTimeline,
      updateLoopTimelineItems,
      getTimeline,
      getLoopTimeline,
      setSelectedTrial,
    });

  const { createLoop, getLoop, updateLoop, updateLoopField, deleteLoop } =
    LoopMethods({
      experimentID,
      timeline,
      loopTimelineCache,
      setTimeline,
      updateLoopTimelineItems,
      getTimeline,
      getLoopTimeline,
      selectedLoop,
      setSelectedLoop,
    });

  // ==================== TIMELINE METHODS ====================

  const updateTimeline = useCallback(
    async (newTimeline: TimelineItem[]): Promise<boolean> => {
      try {
        const response = await fetch(
          `${API_URL}/api/timeline/${experimentID}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timeline: newTimeline }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update timeline");
        }

        // Actualizar estado local
        setTimeline(newTimeline);

        return true;
      } catch (error) {
        console.error("Error updating timeline:", error);
        return false;
      }
    },
    [experimentID, setTimeline],
  );

  // ==================== DELETE ALL ====================

  const deleteAllTrials = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/trials/${experimentID}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete all trials");
      }

      // Limpiar estado local
      setTimeline([]);
      setSelectedTrial(null);
      setSelectedLoop(null);
      resetLoopTimelineCache();

      return true;
    } catch (error) {
      console.error("Error deleting all trials:", error);
      return false;
    }
  }, [experimentID, resetLoopTimelineCache, setTimeline]);

  // ==================== INITIAL LOAD ====================

  useEffect(() => {
    if (experimentID) {
      getTimeline();
    }
  }, [experimentID, getTimeline]);

  const contextValue = useMemo<TrialsContextType>(
    () => ({
      timeline,
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
      isLoading,
      loopTimeline,
      loopTimelineCache,
      selectedLoop,
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
