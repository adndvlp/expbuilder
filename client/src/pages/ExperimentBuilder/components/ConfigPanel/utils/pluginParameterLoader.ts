// utils/pluginParameterLoader.ts
import {
  mapMetadataToFields,
  mapMetadataToData,
} from "../utils/metadataMapper";
import type { FieldDefinition, DataDefinition } from "../types";
const API_URL = import.meta.env.VITE_API_URL;

export async function loadPluginParameters(
  pluginName: string
): Promise<{ parameters: FieldDefinition[]; data: DataDefinition[] }> {
  const response = await fetch(`${API_URL}/api/metadata/${pluginName}.json`);
  if (!response.ok) throw new Error("Metadata not found");
  const metadata = await response.json();

  if (!metadata.parameters) {
    throw new Error(`No parameters found for plugin: ${pluginName}`);
  }

  return {
    parameters: mapMetadataToFields(metadata.parameters),
    data: mapMetadataToData(metadata.data || {}),
  };
}
