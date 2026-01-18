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

        // Optimistic UI: agregar al timeline localmente
        setTimeline((prev) => [
          ...prev,
          {
            id: newTrial.id,
            type: "trial",
            name: newTrial.name,
            branches: newTrial.branches || [],
          },
        ]);

        return newTrial;
      } catch (error) {
        console.error("Error creating trial:", error);
        // Si falla, recargar timeline
        await getTimeline();
        throw error;
      }
    },
    [experimentID, getTimeline],
  );

  const getTrial = useCallback(
    async (id: string | number): Promise<Trial | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
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
    [experimentID],
  );

  const updateTrial = useCallback(
    async (
      id: string | number,
      trial: Partial<Trial>,
    ): Promise<Trial | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trial),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update trial");
        }

        const data = await response.json();
        const updatedTrial = data.trial;

        // Optimistic UI: actualizar timeline localmente
        setTimeline((prev) =>
          prev.map((item) =>
            item.id === id && item.type === "trial"
              ? {
                  ...item,
                  name: updatedTrial.name,
                  branches: updatedTrial.branches || [],
                }
              : item,
          ),
        );

        // Actualizar selectedTrial si es el que está seleccionado
        if (selectedTrial?.id === id) {
          setSelectedTrial(updatedTrial);
        }

        return updatedTrial;
      } catch (error) {
        console.error("Error updating trial:", error);
        // Si falla, recargar timeline
        await getTimeline();
        return null;
      }
    },
    [experimentID, selectedTrial, getTimeline],
  );

  // Actualización granular de un solo campo (optimizado para autoguardado)
  const updateTrialField = useCallback(
    async (
      id: string | number,
      fieldName: string,
      value: any,
      updateSelectedTrial: boolean = true,
    ): Promise<boolean> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [fieldName]: value }),
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to update ${fieldName}`);
        }

        const data = await response.json();
        const updatedTrial = data.trial;

        // Optimistic UI: actualizar timeline si es campo name o branches
        if (fieldName === "name" || fieldName === "branches") {
          setTimeline((prev) =>
            prev.map((item) =>
              item.id === id && item.type === "trial"
                ? {
                    ...item,
                    name: updatedTrial.name,
                    branches: updatedTrial.branches || [],
                  }
                : item,
            ),
          );
        }

        // Actualizar selectedTrial si es el que está seleccionado y se solicita
        if (updateSelectedTrial && selectedTrial?.id === id) {
          setSelectedTrial(updatedTrial);
        }

        return true;
      } catch (error) {
        console.error(`Error updating ${fieldName}:`, error);

        // Si falla, recargar el trial completo para mantener consistencia
        if (selectedTrial?.id === id) {
          const freshTrial = await getTrial(id);
          if (freshTrial) {
            setSelectedTrial(freshTrial);
          }
        }

        return false;
      }
    },
    [experimentID, selectedTrial, getTrial],
  );

  const deleteTrial = useCallback(
    async (id: string | number): Promise<boolean> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to delete trial");
        }

        // Optimistic UI: eliminar del timeline y limpiar referencias en branches
        setTimeline((prev) =>
          prev
            // 1. Eliminar el trial del timeline
            .filter((item) => item.id !== id)
            // 2. Limpiar referencias del trial en todos los branches
            .map((item) => ({
              ...item,
              branches:
                item.branches?.filter((branchId) => branchId !== id) || [],
            })),
        );

        // Limpiar selección si era el trial eliminado
        if (selectedTrial?.id === id) {
          setSelectedTrial(null);
        }

        return true;
      } catch (error) {
        console.error("Error deleting trial:", error);
        // Si falla, recargar timeline
        await getTimeline();
        return false;
      }
    },
    [experimentID, selectedTrial, getTimeline],
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
              error,
            );
          }
        }

        // Optimistic UI: actualizar timeline igual que el backend
        setTimeline((prev) => {
          // 1. Filtrar los trials que ahora están en el loop
          const filteredTimeline = prev.filter(
            (item) => !loop.trials.includes(item.id),
          );

          // 2. Actualizar branches: reemplazar trial IDs por loop ID
          const updatedTimeline = filteredTimeline.map((item) => {
            // Saltar si este item está dentro del loop (evita referencias circulares)
            if (loop.trials.includes(item.id)) {
              return item;
            }

            // Si tiene branches con trials del loop, reemplazarlos con el loop ID
            if (item.branches && item.branches.length > 0) {
              const hasAnyTrialFromLoop = item.branches.some((branchId) =>
                loop.trials.includes(branchId),
              );

              if (hasAnyTrialFromLoop) {
                // Remover todos los trial IDs que están en el loop
                const filteredBranches = item.branches.filter(
                  (branchId) => !loop.trials.includes(branchId),
                );
                // Agregar el loop ID si no está ya
                if (!filteredBranches.includes(newLoop.id)) {
                  filteredBranches.push(newLoop.id);
                }
                return {
                  ...item,
                  branches: filteredBranches,
                };
              }
            }

            return item;
          });

          // 3. Agregar el nuevo loop al timeline
          return [
            ...updatedTimeline,
            {
              id: newLoop.id,
              type: "loop",
              name: newLoop.name,
              branches: newLoop.branches || [],
              trials: newLoop.trials || [],
            },
          ];
        });

        return newLoop;
      } catch (error) {
        console.error("Error creating loop:", error);
        // Si falla, recargar timeline
        await getTimeline();
        throw error;
      }
    },
    [experimentID, getTimeline],
  );

  const getLoop = useCallback(
    async (id: string | number): Promise<Loop | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
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
    [experimentID],
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
          },
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
            (trialId) => !newTrials.includes(trialId),
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
                error,
              );
            }
          }

          // Trials agregados al loop - asignar parentLoopId
          const addedTrials = newTrials.filter(
            (trialId) => !oldTrials.includes(trialId),
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
                error,
              );
            }
          }
        }

        // Optimistic UI: actualizar timeline localmente
        setTimeline((prev) =>
          prev.map((item) =>
            item.id === id && item.type === "loop"
              ? {
                  ...item,
                  name: updatedLoop.name,
                  branches: updatedLoop.branches || [],
                  trials: updatedLoop.trials || [],
                }
              : item,
          ),
        );

        // Actualizar selectedLoop si es el que está seleccionado
        if (selectedLoop?.id === id) {
          setSelectedLoop(updatedLoop);
        }

        return updatedLoop;
      } catch (error) {
        console.error("Error updating loop:", error);
        // Si falla, recargar timeline
        await getTimeline();
        return null;
      }
    },
    [experimentID, selectedLoop, getTimeline, getLoop],
  );

  // Actualización granular de un solo campo del loop (optimizado para autoguardado)
  const updateLoopField = useCallback(
    async (
      id: string | number,
      fieldName: string,
      value: any,
      updateSelectedLoop: boolean = true,
    ): Promise<boolean> => {
      try {
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [fieldName]: value }),
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to update ${fieldName}`);
        }

        const data = await response.json();
        const updatedLoop = data.loop;

        // Optimistic UI: actualizar timeline si es campo name o branches
        if (fieldName === "name" || fieldName === "branches") {
          setTimeline((prev) =>
            prev.map((item) =>
              item.id === id && item.type === "loop"
                ? {
                    ...item,
                    name: updatedLoop.name,
                    branches: updatedLoop.branches || [],
                    trials: updatedLoop.trials || [],
                  }
                : item,
            ),
          );
        }

        // Actualizar selectedLoop si es el que está seleccionado y se solicita
        if (updateSelectedLoop && selectedLoop?.id === id) {
          setSelectedLoop(updatedLoop);
        }

        return true;
      } catch (error) {
        console.error(`Error updating ${fieldName}:`, error);

        // Si falla, recargar el loop completo para mantener consistencia
        if (selectedLoop?.id === id) {
          const freshLoop = await getLoop(id);
          if (freshLoop) {
            setSelectedLoop(freshLoop);
          }
        }

        return false;
      }
    },
    [experimentID, selectedLoop, getLoop],
  );

  const deleteLoop = useCallback(
    async (id: string | number): Promise<boolean> => {
      try {
        // Get loop before deleting to get its trials
        const loopToDelete = await getLoop(id);

        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          {
            method: "DELETE",
          },
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
                error,
              );
            }
          }
        }

        // Deseleccionar si es el seleccionado
        if (selectedLoop?.id === id) {
          setSelectedLoop(null);
        }

        // Recargar timeline para reflejar los cambios correctamente
        // (trials restaurados al timeline o agregados a branches según corresponda)
        await getTimeline();

        return true;
      } catch (error) {
        console.error("Error deleting loop:", error);
        // Si falla, recargar timeline
        await getTimeline();
        return false;
      }
    },
    [experimentID, selectedLoop, getTimeline, getLoop],
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
