import { createContext } from "react";
import { Trial } from "../components/ConfigPanel/types";

type TrialsContextType = {
  trials: Trial[];
  setTrials: (trial: Trial[]) => void;
  selectedTrial: Trial | null;
  setSelectedTrial: (trial: Trial | null) => void;
};

const TrialsContext = createContext<TrialsContextType>({
  trials: [],
  setTrials: () => {},
  selectedTrial: null,
  setSelectedTrial: () => {},
});

export default TrialsContext;
