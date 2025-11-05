import { useCallback, useEffect, useState } from "react";
import { getPlugins, savePlugin, deletePlugin, Plugin } from "../plugins";

export function usePlugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlugins();
      setPlugins(data);
    } catch (err: any) {
      setError(err.message || "Error loading plugins");
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (index: number, plugin: Omit<Plugin, "index">) => {
      setLoading(true);
      setError(null);
      try {
        const saved = await savePlugin(index, plugin);
        setPlugins((prev) => {
          const exists = prev.findIndex((p) => p.index === index);
          if (exists >= 0) {
            const copy = [...prev];
            copy[exists] = saved;
            return copy;
          } else {
            return [...prev, saved];
          }
        });
      } catch (err: any) {
        setError(err.message || "Error saving plugin");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const remove = useCallback(async (index: number) => {
    setLoading(true);
    setError(null);
    try {
      const ok = await deletePlugin(index);
      if (ok) setPlugins((prev) => prev.filter((p) => p.index !== index));
    } catch (err: any) {
      setError(err.message || "Error deleting plugin");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  return { plugins, loading, error, fetchPlugins, save, remove };
}
