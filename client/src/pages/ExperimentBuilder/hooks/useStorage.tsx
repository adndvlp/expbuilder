import { useEffect, useState } from "react";

export function useExperimentStorage(experimentID: string) {
  const [storage, setStorage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (experimentID) {
      fetch(`${import.meta.env.VITE_API_URL}/api/experiment/${experimentID}`)
        .then((res) => res.json())
        .then((data) => {
          const storageValue = data.experiment?.storage || "drive";
          setStorage(storageValue);
          // Guardar en localStorage
          try {
            localStorage.setItem(
              `experiment_storage_${experimentID}`,
              storageValue
            );
          } catch (e) {
            // Ignorar errores de localStorage
          }
        });
    }
  }, [experimentID]);

  return storage;
}
