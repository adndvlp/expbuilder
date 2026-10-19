import { createContext } from "react";
import {
  ExperimentAppearance,
  DEFAULT_EXPERIMENT_APPEARANCE,
} from "../appearance";

type ExperimentAppearanceContextType = {
  appearance: ExperimentAppearance;
  setAppearance: React.Dispatch<React.SetStateAction<ExperimentAppearance>>;
};

const ExperimentAppearanceContext =
  createContext<ExperimentAppearanceContextType>({
    appearance: DEFAULT_EXPERIMENT_APPEARANCE,
    setAppearance: () => {},
  });

export default ExperimentAppearanceContext;
