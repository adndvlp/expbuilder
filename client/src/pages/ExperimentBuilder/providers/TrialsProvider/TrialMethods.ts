import { Dispatch, SetStateAction, useCallback } from "react";
import { Trial } from "../../components/ConfigurationPanel/types";
import { TimelineItem } from "../../contexts/TrialsContext";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  experimentID: string | undefined;
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  setLoopTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  getTimeline: () => Promise<void>;
  selectedTrial: Trial | null;
  setSelectedTrial: (trial: Trial | null) => void;
};

export default function TrialMethods({
  selectedTrial,
  experimentID,
  setTimeline,
  setLoopTimeline,
  getTimeline,
  setSelectedTrial,
}: Props) {
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

        // Optimistic UI: actualizar el timeline correcto
        const updateTimelineFn = (prev: TimelineItem[]) => {
          // 1. Actualizar el trial que se está modificando
          const updated = prev.map((item) =>
            item.id === id && item.type === "trial"
              ? {
                  ...item,
                  name: updatedTrial.name,
                  branches: updatedTrial.branches || [],
                }
              : item,
          );

          // 2. Agregar trials de branches que no estén en el timeline
          if (updatedTrial.branches && updatedTrial.branches.length > 0) {
            const existingIds = new Set(updated.map((item) => item.id));
            const missingBranchIds = updatedTrial.branches.filter(
              (branchId: number | string) => !existingIds.has(branchId),
            );

            // Para cada branch faltante, agregarlo al timeline
            missingBranchIds.forEach((branchId: number | string) => {
              // Si es el trial recién creado, usar sus datos reales
              if (newBranchTrial && newBranchTrial.id === branchId) {
                updated.push({
                  id: newBranchTrial.id,
                  type: "trial" as const,
                  name: newBranchTrial.name,
                  branches: newBranchTrial.branches || [],
                });
              } else {
                // Para otros branches, usar placeholder (se actualizarán después)
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

        if (updatedTrial.parentLoopId) {
          setLoopTimeline(updateTimelineFn);
        } else {
          setTimeline(updateTimelineFn);
        }

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
    [
      experimentID,
      selectedTrial,
      getTimeline,
      setLoopTimeline,
      setSelectedTrial,
      setTimeline,
    ],
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
    [experimentID, selectedTrial, getTrial, setSelectedTrial, setTimeline],
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

        // Optimistic UI: eliminar del timeline correcto y limpiar referencias en branches
        const updateTimelineFn = (prev: any[]) =>
          prev
            // 1. Eliminar el trial del timeline
            .filter((item) => item.id !== id)
            // 2. Limpiar referencias del trial en todos los branches
            .map((item) => ({
              ...item,
              branches:
                item.branches?.filter(
                  (branchId: string | number) => branchId !== id,
                ) || [],
            }));

        // Actualizar ambos timelines para cubrir todos los casos
        setTimeline(updateTimelineFn);
        setLoopTimeline(updateTimelineFn);

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
    [
      experimentID,
      selectedTrial,
      getTimeline,
      setLoopTimeline,
      setSelectedTrial,
      setTimeline,
    ],
  );
  return { createTrial, getTrial, updateTrial, updateTrialField, deleteTrial };
}
