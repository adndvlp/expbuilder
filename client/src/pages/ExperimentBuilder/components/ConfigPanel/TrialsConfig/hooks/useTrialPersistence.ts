import { useEffect } from "react";
import { useExperimentID } from "../../../../hooks/useExperimentID";
const API_URL = import.meta.env.VITE_API_URL;

type UseTrialPersistenceProps = {
  trials: any[];
  setTrials: (trials: any[]) => void;
  selectedTrial: any;
  setSelectedTrial: (trial: any) => void;
};

export function useTrialPersistence({
  trials,
  setTrials,
  selectedTrial,
  setSelectedTrial,
}: UseTrialPersistenceProps) {
  // Guardar trials en la base de datos cuando cambian
  const experimentID = useExperimentID();

  useEffect(() => {
    const saveTrials = async () => {
      try {
        const savedTrials = { trials };
        const response = await fetch(
          `${API_URL}/api/save-trials/${experimentID}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(savedTrials),
            credentials: "include",
            mode: "cors",
          }
        );
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
      } catch (error) {
        console.error("Error saving trial:", error);
      }
    };
    if (trials.length > 0) {
      saveTrials();
    }
  }, [trials]);

  // Borrar trial de la base de datos
  const deleteTrial = async (id: number) => {
    try {
      const response = await fetch(
        `${API_URL}/api/trials/${id}/${experimentID}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error deleting trial:", error);
    }
  };

  // Borrar trial del estado global y de la base de datos
  const handleDeleteTrial = () => {
    if (!selectedTrial) return;
    const updatedTrials = trials.filter((t) => t.id !== selectedTrial.id);
    setTrials(updatedTrials);
    setSelectedTrial(null);
    deleteTrial(selectedTrial.id);
  };

  return {
    handleDeleteTrial,
  };
}
