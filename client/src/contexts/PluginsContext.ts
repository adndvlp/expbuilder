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
  isSaving: boolean;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  metadataError: string;
  setMetadataError: React.Dispatch<React.SetStateAction<string>>;
};

const PluginsContext = createContext<PluginsContextType | undefined>(undefined);

export default PluginsContext;
