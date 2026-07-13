import { useCallback } from "react";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { LoopMethodsWithGetLoop } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export default function useUpdateLoopField({
  experimentID,
  setTimeline,
  setLoopTimeline,
  selectedLoop,
  setSelectedLoop,
  getLoop,
}: LoopMethodsWithGetLoop) {
  return useCallback(
    async (
      id: string | number,
      fieldName: string,
      value: any,
      updateSelectedLoop: boolean = true,
    ): Promise<boolean> => {
      try {
        // Determinar si es nested loop
        let isNestedLoop = false;
        if (selectedLoop?.id === id) {
          isNestedLoop = selectedLoop.parentLoopId != null;
        }

        // OPTIMISTIC UI PRIMERO
        if (
          fieldName === "name" ||
          fieldName === "branches" ||
          fieldName === "trials"
        ) {
          const optimisticUpdateFn = (prev: TimelineItem[]) =>
            prev.map((item) => {
              if (item.id === id && item.type === "loop") {
                return {
                  ...item,
                  [fieldName]: value,
                };
              }
              return item;
            });

          if (isNestedLoop) {
            setLoopTimeline(optimisticUpdateFn);
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

          if (updatedLoop.parentLoopId) {
            setLoopTimeline(finalUpdateFn);
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
      selectedLoop,
      getLoop,
      setTimeline,
      setLoopTimeline,
      setSelectedLoop,
    ],
  );
}
