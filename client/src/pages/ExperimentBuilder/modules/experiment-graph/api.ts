import type { ExperimentGraphSnapshot } from "./types";

const API_URL = import.meta.env.VITE_API_URL;

export async function loadExperimentGraph(
  experimentId: string,
): Promise<ExperimentGraphSnapshot> {
  const response = await fetch(
    `${API_URL}/api/experiment-graph/${experimentId}`,
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
