import type { ExperimentGraphSnapshot } from "./types";
import { getApiBaseUrl } from "../../../../lib/apiBaseUrl";

const API_URL = getApiBaseUrl() ?? "";

export async function loadExperimentGraph(
  experimentId: string,
  options: { apiBaseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<ExperimentGraphSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBaseUrl = options.apiBaseUrl ?? API_URL ?? "";
  const response = await fetchImpl(
    `${apiBaseUrl}/api/experiment-graph/${experimentId}`,
  );
  if (!response.ok) throw new Error("Failed to load experiment graph");
  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("graph" in data) ||
    typeof data.graph !== "object" ||
    data.graph === null ||
    !("root" in data.graph) ||
    !("scopes" in data.graph) ||
    !("edges" in data.graph)
  ) {
    throw new Error("Invalid experiment graph response");
  }
  return data.graph as ExperimentGraphSnapshot;
}
