// utils/pluginParameterLoader.ts
import { mapMetadataToFields, mapMetadataToData } from "./metadataMapper";
import type { FieldDefinition, DataDefinition } from "../types";
import { getApiBaseUrl } from "../../../../../lib/apiBaseUrl";

export async function loadPluginParameters(
  pluginName: string,
  options: { apiBaseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ parameters: FieldDefinition[]; data: DataDefinition[] }> {
  const apiBaseUrl = options.apiBaseUrl ?? getApiBaseUrl();
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${apiBaseUrl}/api/metadata/${pluginName}.json`,
  );
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
