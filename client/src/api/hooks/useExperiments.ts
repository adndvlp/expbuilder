import { useEffect, useState, useCallback } from "react";
import {
  getExperiments,
  addExperiment,
  deleteExperiment,
  Experiment,
} from "../experiments";

export function useExperiments() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExperiments();
      setExperiments(data);
    } catch (err: any) {
      setError(err.message || "Error loading experiments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const add = useCallback(
    async (
      exp: Omit<Experiment, "experimentID" | "createdAt" | "updatedAt">
    ) => {
      await addExperiment(exp);
      await fetchExperiments();
    },
    [fetchExperiments]
  );

  const remove = useCallback(
    async (experimentID: string) => {
      await deleteExperiment(experimentID);
      await fetchExperiments();
    },
    [fetchExperiments]
  );

  return {
    experiments,
    loading,
    error,
    add,
    remove,
    refresh: fetchExperiments,
  };
}
