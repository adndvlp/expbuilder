import { useContext } from "react";
import ExperimentAppearanceContext from "../contexts/ExperimentAppearanceContext";

export default function useExperimentAppearance() {
  return useContext(ExperimentAppearanceContext);
}
