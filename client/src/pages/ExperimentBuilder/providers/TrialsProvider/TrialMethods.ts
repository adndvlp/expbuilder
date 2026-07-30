import { useCallback } from "react";
import type { Trial } from "../../components/ConfigurationPanel/types";
import type { TimelineItem } from "../../contexts/TrialsContext";
import { findTimelineItemLocation } from "./itemScope";
import type { TrialMethodsProps } from "./types";
import {
  removeTrialFromTimeline,
  updateTrialMetadata,
  updateTrialWithBranches,
} from "./trialTimelineUpdates";
const API_URL = import.meta.env.VITE_API_URL;
const idsMatch = (left: string | number, right: string | number) =>
  String(left) === String(right);

export default function useTrialMethods({
  getSelectedTrial,
  experimentID,
  timeline,
  loopTimelineCache,
  setTimeline,
  updateLoopTimelineItems,
  getTimeline,
  getLoopTimeline,
  setSelectedTrial,
}: TrialMethodsProps) {
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

        // NO actualizar timeline optimísticamente aquí
        // El backend ya maneja la lógica de agregar al timeline
        // Si es branch, updateTrial del parent lo agregará cuando actualice branches
        // Si no es branch, se agregará en el siguiente getTimeline/getLoopTimeline

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
      newBranchTrial?: Trial, // Trial recién creado como branch
    ): Promise<Trial | null> => {
      const updatesTimeline =
        typeof trial.name === "string" || Array.isArray(trial.branches);
      const location = findTimelineItemLocation(
        id,
        timeline,
        loopTimelineCache,
      );
      const selected = getSelectedTrial();
      const parentLoopId = location
        ? location.parentLoopId
        : selected && idsMatch(selected.id, id)
          ? (selected.parentLoopId ?? null)
          : null;
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

        if (updatesTimeline) {
          const updateTimelineFn = (items: TimelineItem[]) =>
            updateTrialWithBranches(items, id, updatedTrial, newBranchTrial);

          if (updatedTrial.parentLoopId != null) {
            updateLoopTimelineItems(
              updatedTrial.parentLoopId,
              updateTimelineFn,
            );
          } else {
            setTimeline(updateTimelineFn);
          }
        }

        // Actualizar selectedTrial si es el que está seleccionado
        setSelectedTrial((current) =>
          current && idsMatch(current.id, id) ? updatedTrial : current,
        );

        return updatedTrial;
      } catch (error) {
        console.error("Error updating trial:", error);
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
      getSelectedTrial,
      getLoopTimeline,
      getTimeline,
      loopTimelineCache,
      setSelectedTrial,
      setTimeline,
      timeline,
      updateLoopTimelineItems,
    ],
  );

  // Actualización granular de un solo campo (optimizado para autoguardado)
  const updateTrialField = useCallback(
    async (
      id: string | number,
      fieldName: string,
      value: unknown,
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
          const updateTimelineItems = (items: TimelineItem[]) =>
            updateTrialMetadata(items, id, updatedTrial);

          if (updatedTrial.parentLoopId != null) {
            updateLoopTimelineItems(
              updatedTrial.parentLoopId,
              updateTimelineItems,
            );
          } else {
            setTimeline(updateTimelineItems);
          }
        }

        // Actualizar selectedTrial si es el que está seleccionado y se solicita
        if (updateSelectedTrial) {
          setSelectedTrial((current) =>
            current && idsMatch(current.id, id) ? updatedTrial : current,
          );
        }

        return true;
      } catch (error) {
        console.error(`Error updating ${fieldName}:`, error);

        // Si falla, recargar el trial completo para mantener consistencia
        const freshTrial = await getTrial(id);
        if (freshTrial) {
          setSelectedTrial((current) =>
            current && idsMatch(current.id, id) ? freshTrial : current,
          );
        }

        return false;
      }
    },
    [
      experimentID,
      getTrial,
      setSelectedTrial,
      setTimeline,
      updateLoopTimelineItems,
    ],
  );

  const deleteTrial = useCallback(
    async (id: string | number): Promise<boolean> => {
      const location = findTimelineItemLocation(
        id,
        timeline,
        loopTimelineCache,
      );
      const selected = getSelectedTrial();
      const parentLoopId = location
        ? location.parentLoopId
        : selected && idsMatch(selected.id, id)
          ? (selected.parentLoopId ?? null)
          : null;
      try {
        const updateTimelineItems = (items: TimelineItem[]) =>
          removeTrialFromTimeline(items, id);
        if (parentLoopId != null) {
          updateLoopTimelineItems(parentLoopId, updateTimelineItems);
        } else {
          setTimeline(updateTimelineItems);
        }

        setSelectedTrial((current) =>
          current && idsMatch(current.id, id) ? null : current,
        );

        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to delete trial");
        }

        return true;
      } catch (error) {
        console.error("Error deleting trial:", error);
        if (parentLoopId != null) {
          await getLoopTimeline(parentLoopId, {
            mode: "cache",
            forceRefresh: true,
          });
        } else {
          await getTimeline();
        }
        return false;
      }
    },
    [
      experimentID,
      getSelectedTrial,
      getLoopTimeline,
      getTimeline,
      loopTimelineCache,
      setSelectedTrial,
      setTimeline,
      timeline,
      updateLoopTimelineItems,
    ],
  );
  return { createTrial, getTrial, updateTrial, updateTrialField, deleteTrial };
}
