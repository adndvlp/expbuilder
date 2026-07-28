import { useCallback } from "react";
import type { TimelineItem } from "../../../contexts/TrialsContext";
import { findTimelineItemLocation } from "../itemScope";
import type { LoopMethodsWithGetLoop } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export default function useUpdateLoopField({
  experimentID,
  timeline,
  loopTimelineCache,
  setTimeline,
  updateLoopTimelineItems,
  selectedLoop,
  setSelectedLoop,
  getLoop,
}: LoopMethodsWithGetLoop) {
  return useCallback(
    async (
      id: string | number,
      fieldName: string,
      value: unknown,
      updateSelectedLoop: boolean = true,
    ): Promise<boolean> => {
      let parentLoopId: string | number | null = null;
      try {
        parentLoopId =
          selectedLoop && String(selectedLoop.id) === String(id)
            ? (selectedLoop.parentLoopId ?? null)
            : (findTimelineItemLocation(id, timeline, loopTimelineCache)
                ?.parentLoopId ?? null);

        if (
          fieldName === "name" ||
          fieldName === "branches" ||
          fieldName === "trials"
        ) {
          const optimisticUpdateFn = (prev: TimelineItem[]) => {
            let changed = false;
            const next = prev.map((item) => {
              if (item.id === id && item.type === "loop") {
                changed = true;
                return {
                  ...item,
                  [fieldName]: value,
                };
              }
              return item;
            });
            return changed ? next : prev;
          };

          if (parentLoopId != null) {
            updateLoopTimelineItems(parentLoopId, optimisticUpdateFn);
          } else {
            setTimeline(optimisticUpdateFn);
          }
        }

        // BACKEND
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

        // ACTUALIZAR UI CON DATOS REALES
        if (
          fieldName === "name" ||
          fieldName === "branches" ||
          fieldName === "trials"
        ) {
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

          parentLoopId = updatedLoop.parentLoopId ?? parentLoopId;
          if (parentLoopId != null) {
            updateLoopTimelineItems(parentLoopId, finalUpdateFn);
          } else {
            setTimeline(finalUpdateFn);
          }
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
    [
      experimentID,
      getLoop,
      loopTimelineCache,
      selectedLoop,
      setTimeline,
      setSelectedLoop,
      timeline,
      updateLoopTimelineItems,
    ],
  );
}
