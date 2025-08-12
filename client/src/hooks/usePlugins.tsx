import { useContext } from "react";
import PluginsConfig from "../contexts/PluginsContext";

export default function useDevMode() {
  const context = useContext(PluginsConfig);
  if (context === undefined) {
    throw new Error("usePlugins must be used within a PluginsProvider");
  }
  return context;
}
