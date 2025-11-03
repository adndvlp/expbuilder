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

  // Borrar trial del estado global y de la base de datos, y eliminar referencias en branches
  const handleDeleteTrial = () => {
    if (!selectedTrial) return;
    const trialIdToDelete = selectedTrial.id;
    // Elimina el trial del array principal
    let updatedTrials = trials.filter((t) => t.id !== trialIdToDelete);

    // Elimina referencias en branches de todos los trials y loops
    updatedTrials = updatedTrials.map((t: any) => {
      // Si es un trial con branches
      if (t.branches && Array.isArray(t.branches)) {
        return {
          ...t,
          branches: t.branches.filter(
            (id: number | string) =>
              id !== trialIdToDelete && id !== String(trialIdToDelete)
          ),
        };
      }
      // Si es un loop con trials
      if (t.trials && Array.isArray(t.trials)) {
        return {
          ...t,
          trials: t.trials
            .map((trial: any) => {
              if (trial.branches && Array.isArray(trial.branches)) {
                return {
                  ...trial,
                  branches: trial.branches.filter(
                    (id: number | string) =>
                      id !== trialIdToDelete && id !== String(trialIdToDelete)
                  ),
                };
              }
              return trial;
            })
            .filter((trial: any) => trial.id !== trialIdToDelete),
        };
      }
      return t;
    });

    setTrials(updatedTrials);
    setSelectedTrial(null);
    deleteTrial(trialIdToDelete);
  };

  return {
    handleDeleteTrial,
  };
}
