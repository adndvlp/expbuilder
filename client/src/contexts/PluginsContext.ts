import { createContext } from "react";

type Plugin = {
  name: string;
  scripTag: string;
  pluginCode: string;
  index: number;
};

type PluginsContextType = {
  plugins: Plugin[];
  setPlugins: React.Dispatch<React.SetStateAction<Plugin[]>>;
  isPluginEditor: boolean;
  setIsPluginEditor: React.Dispatch<React.SetStateAction<boolean>>;
};

const PluginsContext = createContext<PluginsContextType | undefined>(undefined);

export default PluginsContext;
