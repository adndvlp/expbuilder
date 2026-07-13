import type { Trial } from "../../types";

export type PluginOption = { label: string; value: string };

export interface PluginSelectionHookArgs {
  selectedTrial: Trial | null | undefined;
  updateTrial: (id: string | number, changes: Partial<Trial>) => unknown;
}

export interface PluginSelectionViewModel {
  filteredPluginOptions: PluginOption[];
  handleChange: (option: PluginOption | null) => void;
  handleSwitchChange: (checked: boolean) => void;
  isCustomPlugin: boolean;
  metadata404: boolean;
  metadataError: string;
  pluginEditor: boolean;
  selectedId: string;
  setPluginEditor: (checked: boolean) => void;
  useJsPsychPlugins: boolean;
  webgazerPlugins: string[];
}
