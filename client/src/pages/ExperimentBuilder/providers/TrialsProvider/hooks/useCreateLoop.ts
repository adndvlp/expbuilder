import { useCallback } from "react";
import { Loop } from "../../../components/ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { LoopMethodsProps } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export default function useCreateLoop({
  experimentID,
  setTimeline,
  updateLoopTimelineItems,
  getTimeline,
  getLoopTimeline,
}: LoopMethodsProps) {
  return useCallback(
    async (loop: Omit<Loop, "id">): Promise<Loop> => {
      // Determinar si es nested loop (si los trials tienen parentLoopId)
      const isNestedLoop = loop.parentLoopId != null;
      const tempLoopId = `temp-loop-${Date.now()}`;

      // OPTIMISTIC UI PRIMERO - actualizar el timeline correcto
      const optimisticUpdateFn = (prev: TimelineItem[]) => {
        // 1. Filtrar los trials/loops que ahora están dentro del nuevo loop
        const filteredTimeline = prev.filter(
          (item) => !loop.trials.includes(item.id),
        );

        // 2. Actualizar branches: reemplazar trial/loop IDs por el ID temporal del loop
        const updatedTimeline = filteredTimeline.map((item) => {
          // Si tiene branches con trials/loops del nuevo loop, reemplazarlos
          if (item.branches && item.branches.length > 0) {
            const hasAnyItemFromLoop = item.branches.some((branchId) =>
              loop.trials.includes(branchId),
            );

            if (hasAnyItemFromLoop) {
              // Remover todos los IDs que están en el loop
              const filteredBranches = item.branches.filter(
                (branchId) => !loop.trials.includes(branchId),
              );
              // Agregar el loop ID temporal si no está ya
              if (!filteredBranches.includes(tempLoopId)) {
                filteredBranches.push(tempLoopId);
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
            id: tempLoopId,
            type: "loop" as const,
            name: loop.name,
            branches: loop.branches || [],
            trials: loop.trials,
          },
        ];
      };

      if (isNestedLoop && loop.parentLoopId != null) {
        updateLoopTimelineItems(loop.parentLoopId, optimisticUpdateFn);
      } else {
        setTimeline(optimisticUpdateFn);
      }

      try {
        // BACKEND - crear el loop
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

        // Actualizar parentLoopId en todos los trials/loops del loop
        for (const itemId of loop.trials) {
          try {
            // Determinar si es trial o loop
            await fetch(`${API_URL}/api/trial/${experimentID}/${itemId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ parentLoopId: newLoop.id }),
            });
          } catch (error) {
            // Si falla como trial, intentar como loop
            try {
              await fetch(`${API_URL}/api/loop/${experimentID}/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentLoopId: newLoop.id }),
              });
            } catch (loopError) {
              console.error(
                `Error updating parentLoopId for item ${itemId}:`,
                error,
                loopError,
              );
            }
          }
        }

        // ACTUALIZAR UI CON ID REAL - reemplazar el loop temporal con el real
        const replaceWithRealId = (prev: TimelineItem[]) =>
          prev.map((item) => {
            // Reemplazar el loop temporal con el real
            if (
              item.id === tempLoopId
            ) {
              return {
                ...item,
                id: newLoop.id,
              };
            }
            // Actualizar branches que apuntaban al ID temporal
            if (item.branches && item.branches.length > 0) {
              const updatedBranches = item.branches.map((branchId) =>
                branchId === tempLoopId
                  ? newLoop.id
                  : branchId,
              );
              return {
                ...item,
                branches: updatedBranches,
              };
            }
            return item;
          });

        if (isNestedLoop && loop.parentLoopId != null) {
          updateLoopTimelineItems(loop.parentLoopId, replaceWithRealId);
        } else {
          setTimeline(replaceWithRealId);
        }

        return newLoop;
      } catch (error) {
        console.error("Error creating loop:", error);
        // Si falla, recargar timeline apropiado
        if (isNestedLoop && loop.parentLoopId != null) {
          await getLoopTimeline(loop.parentLoopId, {
            mode: "cache",
            forceRefresh: true,
          });
        } else {
          await getTimeline();
        }
        throw error;
      }
    },
    [
      experimentID,
      getLoopTimeline,
      getTimeline,
      setTimeline,
      updateLoopTimelineItems,
    ],
  );
}
