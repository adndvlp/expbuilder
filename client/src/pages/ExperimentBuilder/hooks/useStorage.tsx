import { useEffect, useState } from "react";

export function useExperimentStorage(experimentID: string) {
  const [storage, setStorage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (experimentID) {
      fetch(`${import.meta.env.API_URL}/api/experiment/${experimentID}`)
        .then((res) => res.json())
        .then((data) => setStorage(data.experiment?.storage || "drive"));
    }
  }, [experimentID]);

  return storage;
}
