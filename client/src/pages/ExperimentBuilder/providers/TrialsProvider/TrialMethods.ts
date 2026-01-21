import { Dispatch, SetStateAction, useCallback } from "react";
import { Trial } from "../../components/ConfigurationPanel/types";
import { TimelineItem } from "../../contexts/TrialsContext";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  experimentID: string | undefined;
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  getTimeline: () => Promise<void>;
  selectedTrial: Trial | null;
  setSelectedTrial: (trial: Trial | null) => void;
};

export default function TrialMethods({
  selectedTrial,
  experimentID,
  setTimeline,
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

        // Optimistic UI: agregar al timeline localmente
        setTimeline((prev) => [
          ...prev,
          {
            id: newTrial.id,
            type: "trial",
            name: newTrial.name,
            branches: newTrial.branches || [],
          },
        ]);

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

        // Optimistic UI: actualizar timeline localmente
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
    [experimentID, selectedTrial, getTimeline],
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
    [experimentID, selectedTrial, getTrial],
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

        // Optimistic UI: eliminar del timeline y limpiar referencias en branches
        setTimeline((prev) =>
          prev
            // 1. Eliminar el trial del timeline
            .filter((item) => item.id !== id)
            // 2. Limpiar referencias del trial en todos los branches
            .map((item) => ({
              ...item,
              branches:
                item.branches?.filter((branchId) => branchId !== id) || [],
            })),
        );

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
    [experimentID, selectedTrial, getTimeline],
  );
  return { createTrial, getTrial, updateTrial, updateTrialField, deleteTrial };
}
