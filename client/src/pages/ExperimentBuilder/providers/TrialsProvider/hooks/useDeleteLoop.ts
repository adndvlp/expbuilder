import { useCallback } from "react";
import { Loop } from "../../../components/ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { LoopMethodsWithGetLoop } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export default function useDeleteLoop({
  experimentID,
  timeline,
  loopTimeline,
  setTimeline,
  setLoopTimeline,
  getTimeline,
  getLoopTimeline,
  selectedLoop,
  setSelectedLoop,
  getLoop,
}: LoopMethodsWithGetLoop) {
  return useCallback(
    async (id: string | number): Promise<boolean> => {
      try {
        // Obtener loop antes de eliminar para saber sus trials, branches y si es nested
        let loopToDelete: Loop | null = null;
        let isNestedLoop = false;

        if (selectedLoop?.id === id) {
          loopToDelete = selectedLoop;
          isNestedLoop = selectedLoop.parentLoopId != null;
        } else {
          loopToDelete = await getLoop(id);
          if (loopToDelete) {
            isNestedLoop = loopToDelete.parentLoopId != null;
          }
        }

        if (!loopToDelete) {
          throw new Error("Loop not found");
        }

        // Obtener los metadatos de TODOS los trials que tienen este parentLoopId
        // (no solo los que están en loop.trials)
        let loopTrialsMetadata: TimelineItem[] = [];
        const hasDataInLoopTimeline =
          selectedLoop?.id === id && loopTimeline.length > 0;

        if (hasDataInLoopTimeline) {
          loopTrialsMetadata = loopTimeline;
        } else {
          try {
            const response = await fetch(
              `${API_URL}/api/loop-trials-metadata/${experimentID}/${id}`,
            );
            if (response.ok) {
              const data = await response.json();
              loopTrialsMetadata = data.trialsMetadata || [];
            }
          } catch (error) {
            console.error("Error fetching loop trials:", error);
          }
        }

        // ========== OPTIMISTIC UI: BORRADO INTELIGENTE ==========
        const optimisticDeleteFn = (prev: TimelineItem[]) => {
          // 1. Encontrar el loop a eliminar
          const loopIndex = prev.findIndex((item) => item.id === id);
          if (loopIndex === -1) return prev;

          const firstTrialId = loopToDelete.trials?.[0] || null;
          const loopBranches = loopToDelete.branches || [];
          let terminalInternalItemId: string | number | null = null;

          // 2. Reconectar padres con el PRIMER trial del loop (mantener estructura interna)
          let updated = prev.map((item) => {
            if (item.branches && item.branches.includes(id)) {
              if (firstTrialId) {
                // Reemplazar el loop con el primer trial
                return {
                  ...item,
                  branches: item.branches.map((branchId) =>
                    branchId === id ? firstTrialId : branchId,
                  ),
                };
              } else {
                // Si el loop está vacío, simplemente remover
                return {
                  ...item,
                  branches: item.branches.filter((branchId) => branchId !== id),
                };
              }
            }
            return item;
          });

          // 3. Conectar los branches del loop con los ÚLTIMOS items de la cadena interna
          if (loopBranches.length > 0 && loopToDelete.trials) {
            // Función helper para encontrar los últimos items
            const findLastItems = (trialIds: (string | number)[]) => {
              const lastItems: (string | number)[] = [];

              for (const trialId of trialIds) {
                const item = loopTrialsMetadata.find((t) => t.id === trialId);
                if (!item) continue;

                const itemBranches = item.branches || [];

                // Verificar si alguno de sus branches está dentro del loop
                const hasBranchesInsideLoop = itemBranches.some((branchId) =>
                  trialIds.includes(branchId),
                );

                // Si no tiene branches dentro del loop, es un item final
                if (!hasBranchesInsideLoop) {
                  lastItems.push(trialId);
                }
              }

              return lastItems.length > 0 ? lastItems : [trialIds[0]];
            };

            const lastItems = findLastItems(loopToDelete.trials);

            // Actualizar al ÚLTIMO último item para agregar los branches del loop
            // (evita crear múltiples padres para el mismo branch)
            terminalInternalItemId = lastItems[lastItems.length - 1];

            updated = updated.map((item) => {
              if (item.id === terminalInternalItemId) {
                const currentBranches = item.branches || [];
                const newBranches = [...currentBranches];

                // Agregar los branches del loop (evitar duplicados)
                loopBranches.forEach((branchId) => {
                  if (!newBranches.includes(branchId)) {
                    newBranches.push(branchId);
                  }
                });

                return {
                  ...item,
                  branches: newBranches,
                };
              }
              return item;
            });
          }

          // 4. Eliminar el loop del timeline
          updated = updated.filter((item) => item.id !== id);

          // 5. Restaurar TODOS los trials/loops con este parentLoopId
          //    (no solo los de loop.trials, incluye branches internos)
          if (loopTrialsMetadata.length > 0) {
            // Usar todos los metadatos obtenidos (incluye branches)
            // IMPORTANTE: Los loops anidados deben dejar de tener parentLoopId
            // porque su padre acaba de ser borrado
            const restoredItems: TimelineItem[] = loopTrialsMetadata.map(
              (item) => {
                const restoredBranches = [...(item.branches || [])];
                if (item.id === terminalInternalItemId) {
                  loopBranches.forEach((branchId) => {
                    if (!restoredBranches.includes(branchId)) {
                      restoredBranches.push(branchId);
                    }
                  });
                }
                const restoredItem: TimelineItem = {
                  id: item.id,
                  type: item.type,
                  name: item.name,
                  branches: restoredBranches,
                  // Los loops restaurados ya no tienen padre
                  parentLoopId: undefined,
                };
                if (item.type === "loop") {
                  restoredItem.trials = item.trials || [];
                }
                return restoredItem;
              },
            );

            // Insertar en la posición donde estaba el loop
            updated.splice(loopIndex, 0, ...restoredItems);
          }

          return updated;
        };

        // Aplicar optimistic update al timeline correcto
        // IMPORTANTE: Verificar si el padre del nested loop realmente existe
        // (puede haber sido borrado antes, dejando el loop con parentLoopId obsoleto)
        let shouldUseLoopTimeline = false;
        if (isNestedLoop && loopToDelete.parentLoopId) {
          // Verificar si el padre existe en el timeline principal o en loopTimeline
          const parentExistsInMainTimeline = timeline.some(
            (item: TimelineItem) =>
              item.id === loopToDelete.parentLoopId && item.type === "loop",
          );
          const parentExistsInLoopTimeline = loopTimeline.some(
            (item: TimelineItem) =>
              item.id === loopToDelete.parentLoopId && item.type === "loop",
          );

          // Solo usar loopTimeline si el padre realmente existe
          shouldUseLoopTimeline =
            parentExistsInMainTimeline || parentExistsInLoopTimeline;
        }

        if (shouldUseLoopTimeline) {
          setLoopTimeline(optimisticDeleteFn);
        } else {
          setTimeline(optimisticDeleteFn);
        }
        // ========== FIN OPTIMISTIC UI ==========

        // Deseleccionar si es el seleccionado
        if (selectedLoop?.id === id) {
          setSelectedLoop(null);
        }

        // BACKEND - eliminar loop
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to delete loop");
        }

        return true;
      } catch (error) {
        console.error("Error deleting loop:", error);
        // Si falla, recargar timeline apropiado
        if (selectedLoop?.parentLoopId) {
          await getLoopTimeline(selectedLoop.parentLoopId, true, true);
        } else {
          await getTimeline();
        }
        return false;
      }
    },
    [
      experimentID,
      selectedLoop,
      timeline,
      getTimeline,
      getLoopTimeline,
      getLoop,
      setTimeline,
      setLoopTimeline,
      setSelectedLoop,
      loopTimeline,
    ],
  );
}
