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

  // Load plugin config from backend
  useEffect(() => {
    setIsLoading(true);
    fetch("/api/load-plugin-config")
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
    if (isLoading || plugins.length === 0) return;

    const timeoutId = setTimeout(async () => {
      try {
        await Promise.all(
          plugins.map((plugin) =>
            fetch("/api/save-plugins", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(plugin),
            })
          )
        );
      } catch (error) {
        console.error("Error saving plugin config:", error);
      }
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [plugins, isLoading]);

  return (
    <PluginsContext.Provider
      value={{ plugins, setPlugins, isPluginEditor, setIsPluginEditor }}
    >
      {children}
    </PluginsContext.Provider>
  );
}
