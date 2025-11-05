import { useEffect, useState, useCallback } from "react";
import {
  getExperiments,
  addExperiment,
  deleteExperiment,
  Experiment,
  shareLocalExperimentHtml,
} from "../experiments";
import { runExperiment } from "../experiments";

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

/**
 * Genera el HTML y lo abre localmente, retorna la ruta local.
 */
export async function openLocalExperiment(
  experimentID: string,
  generatedCode: string
): Promise<string | undefined> {
  try {
    return await runExperiment(experimentID, generatedCode);
  } catch (err: any) {
    return undefined;
  }
}

/**
 * Genera el HTML y lo abre localmente en el navegador por defecto, retorna { success, error }.
 */
export async function shareLocalExperiment(
  experimentID: string,
  generatedCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const htmlPath = await runExperiment(experimentID, generatedCode);
    return await shareLocalExperimentHtml(htmlPath);
  } catch (err: any) {
    return { success: false, error: err.message || "Error inesperado" };
  }
}
