import { useParams } from "react-router";
import { getApiBaseUrl } from "../../../lib/apiBaseUrl";

export function useExperimentID() {
  const { id } = useParams();
  return id;
}

export async function fetchExperimentNameByID(
  experimentID: string
): Promise<string> {
  const API_URL = getApiBaseUrl();
  const res = await fetch(`${API_URL}/api/experiment/${experimentID}`);
  const data = await res.json();
  return data.experiment?.name || "Experiment";
}
