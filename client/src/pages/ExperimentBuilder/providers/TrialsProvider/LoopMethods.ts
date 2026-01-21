import { Dispatch, SetStateAction, useCallback } from "react";
import { Loop } from "../../components/ConfigurationPanel/types";
import { TimelineItem } from "../../contexts/TrialsContext";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  experimentID: string | undefined;
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  getTimeline: () => Promise<void>;
  setSelectedLoop: Dispatch<SetStateAction<Loop | null>>;
  selectedLoop: Loop | null;
};

export default function LoopMethods({
  experimentID,
  setTimeline,
  getTimeline,
  selectedLoop,
  setSelectedLoop,
}: Props) {
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
  return { createLoop, getLoop, updateLoop, updateLoopField, deleteLoop };
}
