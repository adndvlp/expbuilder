import { useParams } from "react-router-dom";

export function useExperimentID() {
  const { id } = useParams();
  return id;
}

export async function fetchExperimentNameByID(
  experimentID: string
): Promise<string> {
  const API_URL = import.meta.env.VITE_API_URL;
  const res = await fetch(`${API_URL}/api/experiment/${experimentID}`);
  const data = await res.json();
  return data.experiment?.name || "Experiment";
}
