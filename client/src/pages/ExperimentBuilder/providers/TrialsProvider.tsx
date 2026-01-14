import { ReactNode, useEffect, useState, useCallback } from "react";
import TrialsContext, { TimelineItem } from "../contexts/TrialsContext";
import { Trial, Loop } from "../components/ConfigPanel/types";
import { useExperimentID } from "../hooks/useExperimentID";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);
  const [selectedLoop, setSelectedLoop] = useState<Loop | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const experimentID = useExperimentID();

  // ==================== METADATA METHODS ====================

  const loadTrialsMetadata = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_URL}/api/trials-metadata/${experimentID}`
      );

      if (!response.ok) {
        throw new Error("Failed to load trials metadata");
      }

      const data = await response.json();

      // Actualizar timeline (solo metadata: id, type, name, branches)
      setTimeline(data.timeline || []);
    } catch (error) {
      console.error("Error loading trials metadata:", error);
    } finally {
      setIsLoading(false);
    }
  }, [experimentID]);

  const getLoopTrialsMetadata = useCallback(
    async (loopId: string | number): Promise<TimelineItem[]> => {
      try {
        const response = await fetch(
          `${API_URL}/api/loop-trials-metadata/${experimentID}/${loopId}`
        );

        if (!response.ok) {
          throw new Error("Failed to load loop trials metadata");
        }

        const data = await response.json();
        return data.trialsMetadata || [];
      } catch (error) {
        console.error("Error loading loop trials metadata:", error);
        return [];
      }
    },
    [experimentID]
  );

  // ==================== TRIAL METHODS ====================

  const createTrial = useCallback(
    async (trial: Omit<Trial, "id">): Promise<Trial> => {
      try {
        const response = await fetch(`${API_URL}/api/trial/${experimentID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trial),
        });

        if (!response.ok) {
          throw new Error("Failed to create trial");
        }

        const data = await response.json();
        const newTrial = data.trial;

        // Recargar timeline desde backend para tener branches
        await loadTrialsMetadata();

        return newTrial;
      } catch (error) {
        console.error("Error creating trial:", error);
        throw error;
      }
    },
    [experimentID, loadTrialsMetadata]
  );

  const getTrial = useCallback(
    async (id: string | number): Promise<Trial | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data.trial;
      } catch (error) {
        console.error("Error getting trial:", error);
        return null;
      }
    },
    [experimentID]
  );

  const updateTrial = useCallback(
    async (
      id: string | number,
      trial: Partial<Trial>
    ): Promise<Trial | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trial),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update trial");
        }

        const data = await response.json();
        const updatedTrial = data.trial;

        // Recargar timeline para sincronizar branches
        await loadTrialsMetadata();

        // Actualizar selectedTrial si es el que está seleccionado
        if (selectedTrial?.id === id) {
          setSelectedTrial(updatedTrial);
        }

        return updatedTrial;
      } catch (error) {
        console.error("Error updating trial:", error);
        return null;
      }
    },
    [experimentID, selectedTrial, loadTrialsMetadata]
  );

  const deleteTrial = useCallback(
    async (id: string | number): Promise<boolean> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete trial");
        }

        // Recargar timeline desde backend
        await loadTrialsMetadata();

        // Limpiar selección si era el trial eliminado
        if (selectedTrial?.id === id) {
          setSelectedTrial(null);
        }

        return true;
      } catch (error) {
        console.error("Error deleting trial:", error);
        return false;
      }
    },
    [experimentID, selectedTrial, loadTrialsMetadata]
  );

  // ==================== LOOP METHODS ====================

  const createLoop = useCallback(
    async (loop: Omit<Loop, "id">): Promise<Loop> => {
      try {
        const response = await fetch(`${API_URL}/api/loop/${experimentID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loop),
        });

        if (!response.ok) {
          throw new Error("Failed to create loop");
        }

        const data = await response.json();
        const newLoop = data.loop;

        // Recargar timeline desde backend para tener branches y trials
        await loadTrialsMetadata();

        // Actualizar parentLoopId en todos los trials del loop
        for (const trialId of loop.trials) {
          try {
            await fetch(`${API_URL}/api/trial/${experimentID}/${trialId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ parentLoopId: newLoop.id }),
            });
          } catch (error) {
            console.error(
              `Error updating parentLoopId for trial ${trialId}:`,
              error
            );
          }
        }

        return newLoop;
      } catch (error) {
        console.error("Error creating loop:", error);
        throw error;
      }
    },
    [experimentID, loadTrialsMetadata]
  );

  const getLoop = useCallback(
    async (id: string | number): Promise<Loop | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data.loop;
      } catch (error) {
        console.error("Error getting loop:", error);
        return null;
      }
    },
    [experimentID]
  );

  const updateLoop = useCallback(
    async (id: string | number, loop: Partial<Loop>): Promise<Loop | null> => {
      try {
        // Get current loop to compare trials
        const currentLoop = await getLoop(id);

        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loop),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update loop");
        }

        const data = await response.json();
        const updatedLoop = data.loop;

        // Si se actualizó el array de trials, sincronizar parentLoopId
        if (loop.trials && currentLoop) {
          const oldTrials = currentLoop.trials || [];
          const newTrials = loop.trials;

          // Trials removidos del loop - limpiar parentLoopId
          const removedTrials = oldTrials.filter(
            (trialId) => !newTrials.includes(trialId)
          );
          for (const trialId of removedTrials) {
            try {
              await fetch(`${API_URL}/api/trial/${experimentID}/${trialId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentLoopId: null }),
              });
            } catch (error) {
              console.error(
                `Error clearing parentLoopId for trial ${trialId}:`,
                error
              );
            }
          }

          // Trials agregados al loop - asignar parentLoopId
          const addedTrials = newTrials.filter(
            (trialId) => !oldTrials.includes(trialId)
          );
          for (const trialId of addedTrials) {
            try {
              await fetch(`${API_URL}/api/trial/${experimentID}/${trialId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentLoopId: id }),
              });
            } catch (error) {
              console.error(
                `Error setting parentLoopId for trial ${trialId}:`,
                error
              );
            }
          }
        }

        // Recargar timeline para sincronizar branches y trials
        await loadTrialsMetadata();

        // Actualizar selectedLoop si es el que está seleccionado
        if (selectedLoop?.id === id) {
          setSelectedLoop(updatedLoop);
        }

        return updatedLoop;
      } catch (error) {
        console.error("Error updating loop:", error);
        return null;
      }
    },
    [experimentID, selectedLoop, loadTrialsMetadata]
  );

  const deleteLoop = useCallback(
    async (id: string | number): Promise<boolean> => {
      try {
        // Get loop before deleting to clear parentLoopId from trials
        const loopToDelete = await getLoop(id);

        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete loop");
        }

        // Limpiar parentLoopId de los trials que estaban en el loop
        if (loopToDelete && loopToDelete.trials) {
          for (const trialId of loopToDelete.trials) {
            try {
              await fetch(`${API_URL}/api/trial/${experimentID}/${trialId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentLoopId: null }),
              });
            } catch (error) {
              console.error(
                `Error clearing parentLoopId for trial ${trialId}:`,
                error
              );
            }
          }
        }

        // Recargar timeline desde backend
        await loadTrialsMetadata();

        // Deseleccionar si es el seleccionado
        if (selectedLoop?.id === id) {
          setSelectedLoop(null);
        }

        return true;
      } catch (error) {
        console.error("Error deleting loop:", error);
        return false;
      }
    },
    [experimentID, selectedLoop, loadTrialsMetadata]
  );

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
          }
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
    [experimentID]
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
      loadTrialsMetadata();
    }
  }, [experimentID, loadTrialsMetadata]);

  return (
    <TrialsContext.Provider
      value={{
        timeline,
        selectedTrial,
        setSelectedTrial,
        selectedLoop,
        setSelectedLoop,
        createTrial,
        getTrial,
        updateTrial,
        deleteTrial,
        createLoop,
        getLoop,
        updateLoop,
        deleteLoop,
        updateTimeline,
        loadTrialsMetadata,
        getLoopTrialsMetadata,
        deleteAllTrials,
        isLoading,
      }}
    >
      {children}
    </TrialsContext.Provider>
  );
}
