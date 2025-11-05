import { useCallback, useEffect, useState } from "react";
import {
  getTrialsByExperimentID,
  saveTrials,
  deleteTrialById,
  Trial,
} from "../trials";

export function useTrials(experimentID: string) {
  const [trials, setTrials] = useState<Trial[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrialsByExperimentID(experimentID);
      setTrials(data);
    } catch (err: any) {
      setError(err.message || "Error loading trials");
    } finally {
      setLoading(false);
    }
  }, [experimentID]);

  const save = useCallback(
    async (newTrials: Trial[]) => {
      setLoading(true);
      setError(null);
      try {
        await saveTrials(experimentID, newTrials);
        setTrials(newTrials);
      } catch (err: any) {
        setError(err.message || "Error saving trials");
      } finally {
        setLoading(false);
      }
    },
    [experimentID]
  );

  const remove = useCallback(
    async (id: number) => {
      setLoading(true);
      setError(null);
      try {
        const ok = await deleteTrialById(experimentID, id);
        if (ok && trials) {
          setTrials(trials.filter((t) => t.id !== id));
        }
      } catch (err: any) {
        setError(err.message || "Error deleting trial");
      } finally {
        setLoading(false);
      }
    },
    [experimentID, trials]
  );

  useEffect(() => {
    fetchTrials();
  }, [fetchTrials]);

  return { trials, loading, error, fetchTrials, save, remove };
}
