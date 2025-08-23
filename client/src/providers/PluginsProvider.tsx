import { ReactNode, useEffect, useState } from "react";
import PluginsContext from "../contexts/PluginsContext";

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

  // Load plugin config from backend
  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_URL}/api/load-plugin-config`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.plugins)) {
          setPlugins(data.plugins);
        }
      })
      .catch((error) => {
        console.error("Error loading plugins:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Autosave
  useEffect(() => {
    if (isLoading || plugins.length === 0 || isSaving) return;

    setIsSaving(true);
    const timeoutId = setTimeout(async () => {
      try {
        const results = await Promise.all(
          plugins.map((plugin) =>
            fetch(`${API_URL}/api/save-plugins`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(plugin),
            })
              .then((res) => res.json())
              .catch(() => null)
          )
        );
        // Busca si alguna respuesta tiene metadataStatus "error"
        const errorResult = results.find(
          (r) => r && r.metadataStatus === "error"
        );
        if (errorResult) {
          setMetadataError(
            errorResult.metadataError || "Error extracting metadata"
          );
        } else {
          setMetadataError("");
        }
      } catch (error) {
        console.error("Error saving plugin config:", error);
      } finally {
        setIsSaving(false);
      }
    }, 800);
    return () => {
      clearTimeout(timeoutId);
      setIsSaving(false);
    };
  }, [plugins, isLoading]);

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
      }}
    >
      {children}
    </PluginsContext.Provider>
  );
}
