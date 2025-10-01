import { useParams } from "react-router-dom";

export function useExperimentID() {
  const { id } = useParams();
  return id;
}
