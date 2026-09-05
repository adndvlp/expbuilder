import { getApiBaseUrl } from "../../../../../../lib/apiBaseUrl";
const API_URL = getApiBaseUrl();

export async function fetchPluginList(): Promise<string[]> {
  const response = await fetch(`${API_URL}/api/plugins-list`);
  const data = await response.json();
  return data.plugins || [];
}

export async function hasPluginMetadata(pluginName: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/metadata/${pluginName}.json`);
  return response.status !== 404;
}
