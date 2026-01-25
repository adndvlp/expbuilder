import { ReactNode, useEffect, useState } from "react";
import PluginsContext from "../contexts/PluginsContext";
import isEqual from "lodash.isequal";

type Plugin = {
  name: string;
  scripTag: string;
  pluginCode: string;
  index: number;
};

type Props = {
  children: ReactNode;
};

export default function PluginsProvider({ children }: Props) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [isPluginEditor, setIsPluginEditor] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [metadataError, setMetadataError] = useState<string>("");
  const API_URL = import.meta.env.VITE_API_URL;

  // Load all plugins from backend (single request)
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    const loadPlugins = async () => {
      try {
        const res = await fetch(`${API_URL}/api/load-plugins`);
        const data = await res.json();
        if (isMounted) setPlugins(data.plugins || []);
      } catch (err) {
        if (isMounted) setPlugins([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadPlugins();
    return () => {
      isMounted = false;
    };
  }, [API_URL]);

  // Autosave solo si plugins cambian respecto al inicial (como TrialsConfig)

  const [initialPlugins, setInitialPlugins] = useState<Plugin[]>([]);

  useEffect(() => {
    if (!isLoading && initialPlugins.length === 0) {
      setInitialPlugins(plugins);
      return;
    }
    if (isLoading || plugins.length === 0 || isSaving) return;

    if (isEqual(plugins, initialPlugins)) return;

    setIsSaving(true);
    const timeoutId = setTimeout(async () => {
      try {
        const results = await Promise.all(
          plugins.map(async (plugin) => {
            const res = await fetch(
              `${API_URL}/api/save-plugin/${plugin.index}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(plugin),
              },
            );
            return res.json();
          }),
        );
        const errorResult = results.find(
          (r) => r && r.metadataStatus === "error",
        );
        if (errorResult) {
          setMetadataError(
            errorResult.metadataError || "Error extracting metadata",
          );
        } else {
          setMetadataError("");
        }
        setInitialPlugins(plugins);
      } catch (error) {
        console.error("Error saving plugin config:", error);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
    return () => {
      clearTimeout(timeoutId);
      setIsSaving(false);
    };
  }, [plugins, isLoading, initialPlugins, API_URL, isSaving]);

  return (
    <PluginsContext.Provider
      value={{
        plugins,
        setPlugins,
        isPluginEditor,
        setIsPluginEditor,
        isSaving,
        setIsSaving,
        metadataError,
        setMetadataError,
      }}
    >
      {children}
    </PluginsContext.Provider>
  );
}
