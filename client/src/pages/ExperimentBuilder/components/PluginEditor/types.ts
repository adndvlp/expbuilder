export interface Plugin {
  name: string;
  scripTag: string;
  pluginCode: string;
  index: number;
}

export interface PluginEditorProps {
  selectedPluginName?: string;
}
