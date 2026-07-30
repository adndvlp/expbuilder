import { useCallback } from "react";
import type { Loop } from "../../../components/ConfigurationPanel/types";
import type {
  NewBranchItem,
  TimelineItem,
} from "../../../contexts/TrialsContext";
import {
  getLoopTimelineChanges,
  getLoopTimelineSnapshot,
  updateLoopTimeline,
} from "../loopTimelineUpdates";
import { findTimelineItemLocation } from "../itemScope";
import type { LoopMethodsWithGetLoop } from "../types";

const API_URL = import.meta.env.VITE_API_URL;
const idsMatch = (left: string | number, right: string | number) =>
  String(left) === String(right);

export default function useUpdateLoop({
  experimentID,
  timeline,
  loopTimelineCache,
  setTimeline,
  updateLoopTimelineItems,
  getTimeline,
  getLoopTimeline,
  setSelectedLoop,
  getSelectedLoop,
  getLoop,
}: LoopMethodsWithGetLoop) {
  return useCallback(
    async (
      id: string | number,
      loop: Partial<Loop>,
      newBranchItem?: NewBranchItem,
    ): Promise<Loop | null> => {
      let parentLoopId: string | number | null = null;
      try {
        const timelineChanges = getLoopTimelineChanges(loop);
        const location = findTimelineItemLocation(
          id,
          timeline,
          loopTimelineCache,
        );
        const selected = getSelectedLoop();
        const currentLoopData =
          location?.item.type === "loop"
            ? location.item
            : selected && idsMatch(selected.id, id)
              ? selected
              : await getLoop(id);
        if (!currentLoopData) throw new Error("Loop not found");
        parentLoopId = location
          ? location.parentLoopId
          : (currentLoopData.parentLoopId ?? null);

        if (timelineChanges) {
          const optimisticUpdate = (items: TimelineItem[]) =>
            updateLoopTimeline(
              items,
              id,
              timelineChanges,
              newBranchItem,
            );
          if (parentLoopId != null) {
            updateLoopTimelineItems(parentLoopId, optimisticUpdate);
          } else {
            setTimeline(optimisticUpdate);
          }
        }

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
        if (loop.trials !== undefined) {
          const oldTrials = currentLoopData.trials || [];
          const newTrials = loop.trials;
          const oldTrialIds = new Set(oldTrials.map(String));
          const newTrialIds = new Set(newTrials.map(String));

          // Trials/loops removidos del loop - limpiar parentLoopId
          const removedItems = oldTrials.filter(
            (itemId) => !newTrialIds.has(String(itemId)),
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
            (itemId) => !oldTrialIds.has(String(itemId)),
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

        parentLoopId = updatedLoop.parentLoopId ?? parentLoopId;
        if (timelineChanges) {
          const snapshot = getLoopTimelineSnapshot(updatedLoop);
          const finalUpdate = (items: TimelineItem[]) =>
            updateLoopTimeline(items, id, snapshot, newBranchItem);
          if (parentLoopId != null) {
            updateLoopTimelineItems(parentLoopId, finalUpdate);
          } else {
            setTimeline(finalUpdate);
          }
        }

        // Actualizar selectedLoop si es el que está seleccionado
        setSelectedLoop((current) =>
          current && idsMatch(current.id, id) ? updatedLoop : current,
        );

        return updatedLoop;
      } catch (error) {
        console.error("Error updating loop:", error);
        // Si falla, recargar timeline apropiado
        if (parentLoopId != null) {
          await getLoopTimeline(parentLoopId, {
            mode: "cache",
            forceRefresh: true,
          });
        } else {
          await getTimeline();
        }
        return null;
      }
    },
    [
      experimentID,
      getSelectedLoop,
      getTimeline,
      getLoopTimeline,
      getLoop,
      loopTimelineCache,
      setTimeline,
      setSelectedLoop,
      timeline,
      updateLoopTimelineItems,
    ],
  );
}
