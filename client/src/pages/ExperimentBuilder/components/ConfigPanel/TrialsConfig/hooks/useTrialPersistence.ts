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

    // Helper recursivo para eliminar trial y sus referencias
    const removeTrialRecursive = (items: any[]): any[] => {
      return items
        .filter((item: any) => item.id !== trialIdToDelete) // Eliminar el trial si es este item
        .map((item: any) => {
          // Limpiar referencias en branches
          if (item.branches && Array.isArray(item.branches)) {
            item = {
              ...item,
              branches: item.branches.filter(
                (id: number | string) =>
                  id !== trialIdToDelete && id !== String(trialIdToDelete)
              ),
            };
          }

          // Si es un loop, buscar recursivamente en sus trials
          if ("trials" in item && Array.isArray(item.trials)) {
            return {
              ...item,
              trials: removeTrialRecursive(item.trials),
            };
          }

          return item;
        });
    };

    const updatedTrials = removeTrialRecursive(trials);
    setTrials(updatedTrials);
    setSelectedTrial(null);
    deleteTrial(trialIdToDelete);
  };

  return {
    handleDeleteTrial,
  };
}
