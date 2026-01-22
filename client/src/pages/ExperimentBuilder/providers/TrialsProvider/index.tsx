import { ReactNode, useEffect, useState, useCallback } from "react";
import TrialsContext, { TimelineItem } from "../../contexts/TrialsContext";
import { Trial, Loop } from "../../components/ConfigurationPanel/types";
import { useExperimentID } from "../../hooks/useExperimentID";
import TrialMethods from "./TrialMethods";
import LoopMethods from "./LoopMethods";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loopTimeline, setLoopTimeline] = useState<TimelineItem[]>([]);
  const [activeLoopId, setActiveLoopId] = useState<string | number | null>(
    null,
  );
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);
  const [selectedLoop, setSelectedLoop] = useState<Loop | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const experimentID = useExperimentID();

  // ==================== TIMELINE METHODS ====================

  const getTimeline = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_URL}/api/trials-metadata/${experimentID}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load trials timeline");
      }

      const data = await response.json();

      // Actualizar timeline (solo metadata: id, type, name, branches)
      setTimeline(data.timeline || []);
    } catch (error) {
      console.error("Error loading trials timeline:", error);
    } finally {
      setIsLoading(false);
    }
  }, [experimentID]);

  const getLoopTimeline = useCallback(
    async (loopId: string | number): Promise<TimelineItem[]> => {
      try {
        // Si es el mismo loop activo, devolver el estado cacheado
        if (activeLoopId === loopId && loopTimeline.length > 0) {
          return loopTimeline;
        }

        const response = await fetch(
          `${API_URL}/api/loop-trials-metadata/${experimentID}/${loopId}`,
        );

        if (!response.ok) {
          throw new Error("Failed to load loop trials timeline");
        }

        const data = await response.json();
        const timeline = data.trialsMetadata || [];

        // Guardar en el estado SIEMPRE (independientemente de selectedLoop)
        setLoopTimeline(timeline);
        setActiveLoopId(loopId);

        return timeline;
      } catch (error) {
        console.error("Error loading loop trials timeline:", error);
        return [];
      }
    },
    [experimentID, activeLoopId, loopTimeline],
  );

  const clearLoopTimeline = useCallback(() => {
    setLoopTimeline([]);
    setActiveLoopId(null);
  }, []);

  const { createTrial, getTrial, updateTrial, updateTrialField, deleteTrial } =
    TrialMethods({
      selectedTrial,
      experimentID,
      setTimeline,
      setLoopTimeline,
      getTimeline,
      setSelectedTrial,
    });

  const { createLoop, getLoop, updateLoop, updateLoopField, deleteLoop } =
    LoopMethods({
      experimentID,
      timeline,
      loopTimeline,
      setTimeline,
      setLoopTimeline,
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
    [experimentID],
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

      return true;
    } catch (error) {
      console.error("Error deleting all trials:", error);
      return false;
    }
  }, [experimentID]);

  // ==================== INITIAL LOAD ====================

  useEffect(() => {
    if (experimentID) {
      getTimeline();
    }
  }, [experimentID, getTimeline]);

  return (
    <TrialsContext.Provider
      value={{
        timeline,
        loopTimeline,
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
        clearLoopTimeline,
        deleteAllTrials,
        isLoading,
      }}
    >
      {children}
    </TrialsContext.Provider>
  );
}
