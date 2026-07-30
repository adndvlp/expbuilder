import { useCallback } from "react";
import type { TimelineItem } from "../../../contexts/TrialsContext";
import { findTimelineItemLocation } from "../itemScope";
import {
  getLoopTimelineFieldChanges,
  getLoopTimelineSnapshot,
  updateLoopTimeline,
} from "../loopTimelineUpdates";
import type { LoopMethodsWithGetLoop } from "../types";

const API_URL = import.meta.env.VITE_API_URL;
const idsMatch = (left: string | number, right: string | number) =>
  String(left) === String(right);

export default function useUpdateLoopField({
  experimentID,
  timeline,
  loopTimelineCache,
  setTimeline,
  updateLoopTimelineItems,
  setSelectedLoop,
  getSelectedLoop,
  getLoop,
}: LoopMethodsWithGetLoop) {
  return useCallback(
    async (
      id: string | number,
      fieldName: string,
      value: unknown,
      updateSelectedLoop: boolean = true,
    ): Promise<boolean> => {
      try {
        const timelineChanges = getLoopTimelineFieldChanges(
          fieldName,
          value,
        );
        const location = findTimelineItemLocation(
          id,
          timeline,
          loopTimelineCache,
        );
        const selected = getSelectedLoop();
        let parentLoopId = location
          ? location.parentLoopId
          : selected && idsMatch(selected.id, id)
            ? (selected.parentLoopId ?? null)
            : null;

        if (timelineChanges) {
          const optimisticUpdate = (items: TimelineItem[]) =>
            updateLoopTimeline(items, id, timelineChanges);
          if (parentLoopId != null) {
            updateLoopTimelineItems(parentLoopId, optimisticUpdate);
          } else {
            setTimeline(optimisticUpdate);
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
        if (timelineChanges) {
          const snapshot = getLoopTimelineSnapshot(updatedLoop);
          const finalUpdate = (items: TimelineItem[]) =>
            updateLoopTimeline(items, id, snapshot);
          parentLoopId = updatedLoop.parentLoopId ?? parentLoopId;
          if (parentLoopId != null) {
            updateLoopTimelineItems(parentLoopId, finalUpdate);
          } else {
            setTimeline(finalUpdate);
          }
        }

        // Actualizar selectedLoop si es el que está seleccionado y se solicita
        if (updateSelectedLoop) {
          setSelectedLoop((current) =>
            current && idsMatch(current.id, id) ? updatedLoop : current,
          );
        }

        return true;
      } catch (error) {
        console.error(`Error updating ${fieldName}:`, error);

        // Si falla, recargar el loop completo para mantener consistencia
        const freshLoop = await getLoop(id);
        if (freshLoop) {
          setSelectedLoop((current) =>
            current && idsMatch(current.id, id) ? freshLoop : current,
          );
        }

        return false;
      }
    },
    [
      experimentID,
      getLoop,
      getSelectedLoop,
      loopTimelineCache,
      setTimeline,
      setSelectedLoop,
      timeline,
      updateLoopTimelineItems,
    ],
  );
}
