import { useCallback, useEffect, useState } from "react";
import { getConfigByExperimentID, saveConfig } from "../configs";

export function useConfig(experimentID: string) {
  const [config, setConfig] = useState<any>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getConfigByExperimentID(experimentID);
      if (result) {
        setConfig(result.config);
        setIsDevMode(result.isDevMode);
      } else {
        setConfig(null);
        setIsDevMode(false);
      }
    } catch (err: any) {
      setError(err.message || "Error loading config");
    } finally {
      setLoading(false);
    }
  }, [experimentID]);

  const save = useCallback(
    async (newConfig: any, devMode: boolean = false) => {
      setLoading(true);
      setError(null);
      try {
        await saveConfig(experimentID, newConfig, devMode);
        setConfig(newConfig);
        setIsDevMode(devMode);
      } catch (err: any) {
        setError(err.message || "Error saving config");
      } finally {
        setLoading(false);
      }
    },
    [experimentID]
  );

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, isDevMode, loading, error, fetchConfig, save };
}
