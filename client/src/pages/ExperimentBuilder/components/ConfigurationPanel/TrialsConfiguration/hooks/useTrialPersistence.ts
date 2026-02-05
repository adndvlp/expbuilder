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
  // Save trials to the database when they change
  const experimentID = useExperimentID();

  // Delete trial from the database
  const deleteTrial = async (id: number) => {
    try {
      const response = await fetch(
        `${API_URL}/api/trials/${id}/${experimentID}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error deleting trial:", error);
    }
  };

  // Delete trial from global state and database, and remove references in branches
  const handleDeleteTrial = () => {
    if (!selectedTrial) return;
    const trialIdToDelete = selectedTrial.id;

    // Recursive helper to remove trial and its references
    const removeTrialRecursive = (items: any[]): any[] => {
      return items
        .filter((item: any) => item.id !== trialIdToDelete) // Remove the trial if this is the item
        .map((item: any) => {
          // Clean up references in branches
          if (item.branches && Array.isArray(item.branches)) {
            item = {
              ...item,
              branches: item.branches.filter(
                (id: number | string) =>
                  id !== trialIdToDelete && id !== String(trialIdToDelete),
              ),
            };
          }

          // If it is a loop, search recursively in its trials
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
