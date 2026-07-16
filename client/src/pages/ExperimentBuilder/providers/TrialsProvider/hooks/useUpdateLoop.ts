import { useCallback } from "react";
import { Loop } from "../../../components/ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { LoopMethodsWithGetLoop } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export default function useUpdateLoop({
  experimentID,
  setTimeline,
  setLoopTimeline,
  getTimeline,
  getLoopTimeline,
  selectedLoop,
  setSelectedLoop,
  getLoop,
}: LoopMethodsWithGetLoop) {
  return useCallback(
    async (
      id: string | number,
      loop: Partial<Loop>,
      newBranchItem?: any, // Trial o Loop recién creado como branch
    ): Promise<Loop | null> => {
      try {
        // Determinar si es nested loop buscando en ambos timelines
        // (no podemos confiar solo en loop.parentLoopId porque puede no estar en el partial)
        let currentLoop: Loop | null = null;
        let isNestedLoop = false;

        // Buscar primero en selectedLoop
        if (selectedLoop?.id === id) {
          currentLoop = selectedLoop;
          isNestedLoop = selectedLoop.parentLoopId != null;
        }

        // Si no está seleccionado, necesitamos obtenerlo (pero sin hacer fetch innecesario)
        // Un loop con parentLoopId pertenece al scope expandido de otro loop.

        // OPTIMISTIC UI PRIMERO - actualizar antes del fetch
        const optimisticUpdateFn = (prev: TimelineItem[]) => {
          // 1. Actualizar el loop que se está modificando
          const updated = prev.map((item) => {
            if (item.id === id && item.type === "loop") {
              return {
                ...item,
                name: loop.name ?? item.name,
                branches: loop.branches ?? item.branches,
                trials: loop.trials ?? item.trials,
              };
            }
            return item;
          });

          // 2. Agregar items de branches que no estén en el timeline
          const updatedBranches = loop.branches;
          if (updatedBranches && updatedBranches.length > 0) {
            const existingIds = new Set(updated.map((item) => item.id));
            const missingBranchIds = updatedBranches.filter(
              (branchId: number | string) => !existingIds.has(branchId),
            );

            // Para cada branch faltante, agregarlo al timeline
            missingBranchIds.forEach((branchId: number | string) => {
              // Si es el item recién creado, usar sus datos reales
              if (newBranchItem && newBranchItem.id === branchId) {
                // Determinar type: si tiene 'plugin', es trial; si tiene 'trials', es loop
                const itemType =
                  newBranchItem.plugin !== undefined
                    ? "trial"
                    : newBranchItem.trials !== undefined
                      ? "loop"
                      : "trial";
                const branchItem: TimelineItem = {
                  id: newBranchItem.id,
                  type: itemType as "trial" | "loop",
                  name: newBranchItem.name,
                  branches: newBranchItem.branches || [],
                };
                if (itemType === "loop") {
                  branchItem.trials = newBranchItem.trials || [];
                }
                updated.push(branchItem);
              } else {
                // Para otros branches, usar placeholder
                updated.push({
                  id: branchId,
                  type: "trial" as const,
                  name: "Loading...",
                  branches: [],
                });
              }
            });
          }

          return updated;
        };

        // Aplicar optimistic update al timeline correcto
        if (isNestedLoop) {
          setLoopTimeline(optimisticUpdateFn);
        } else {
          setTimeline(optimisticUpdateFn);
        }

        // BACKEND - obtener loop actual y actualizar
        const currentLoopData = currentLoop || (await getLoop(id));
        if (!currentLoopData) {
          throw new Error("Loop not found");
        }

        isNestedLoop = currentLoopData.parentLoopId != null;

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
        if (loop.trials) {
          const oldTrials = currentLoopData.trials || [];
          const newTrials = loop.trials;

          // Trials/loops removidos del loop - limpiar parentLoopId
          const removedItems = oldTrials.filter(
            (itemId) => !newTrials.includes(itemId),
          );
          for (const itemId of removedItems) {
            try {
              // Intentar como trial primero
              await fetch(`${API_URL}/api/trial/${experimentID}/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentLoopId: null }),
              });
            } catch (error) {
              // Si falla, intentar como loop
              try {
                await fetch(`${API_URL}/api/loop/${experimentID}/${itemId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ parentLoopId: null }),
                });
              } catch (loopError) {
                console.error(
                  `Error clearing parentLoopId for item ${itemId}:`,
                  error,
                  loopError,
                );
              }
            }
          }

          // Trials/loops agregados al loop - asignar parentLoopId
          const addedItems = newTrials.filter(
            (itemId) => !oldTrials.includes(itemId),
          );
          for (const itemId of addedItems) {
            try {
              await fetch(`${API_URL}/api/trial/${experimentID}/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentLoopId: id }),
              });
            } catch (error) {
              try {
                await fetch(`${API_URL}/api/loop/${experimentID}/${itemId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ parentLoopId: id }),
                });
              } catch (loopError) {
                console.error(
                  `Error setting parentLoopId for item ${itemId}:`,
                  error,
                  loopError,
                );
              }
            }
          }
        }

        // ACTUALIZAR UI CON DATOS REALES - refinar el optimistic update
        const finalUpdateFn = (prev: TimelineItem[]) =>
          prev.map((item) =>
            item.id === id && item.type === "loop"
              ? {
                  ...item,
                  name: updatedLoop.name,
                  branches: updatedLoop.branches || [],
                  trials: updatedLoop.trials || [],
                }
              : item,
          );

        if (isNestedLoop) {
          setLoopTimeline(finalUpdateFn);
        } else {
          setTimeline(finalUpdateFn);
        }

        // Actualizar selectedLoop si es el que está seleccionado
        if (selectedLoop?.id === id) {
          setSelectedLoop(updatedLoop);
        }

        return updatedLoop;
      } catch (error) {
        console.error("Error updating loop:", error);
        // Si falla, recargar timeline apropiado
        if (selectedLoop?.parentLoopId) {
          await getLoopTimeline(selectedLoop.parentLoopId, true, true);
        } else {
          await getTimeline();
        }
        return null;
      }
    },
    [
      experimentID,
      selectedLoop,
      getTimeline,
      getLoopTimeline,
      getLoop,
      setTimeline,
      setLoopTimeline,
      setSelectedLoop,
    ],
  );
}
