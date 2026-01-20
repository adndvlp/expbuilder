import { createContext } from "react";
import {
  Loop,
  Trial,
  TrialOrLoop,
  MoveItemParams,
} from "../components/ConfigurationPanel/types";

type TrialsContextType = {
  trials: TrialOrLoop[];
  setTrials: (trial: TrialOrLoop[]) => void;
  selectedTrial: Trial | null;
  setSelectedTrial: (trial: Trial | null) => void;
  selectedLoop: Loop | null;
  setSelectedLoop: (loop: Loop | null) => void;
  groupTrialsAsLoop?: (
    trialIndices: number[],
    loopProps?: Partial<Omit<Loop, "trials" | "id">>,
  ) => void;
  moveTrialOrLoop?: (params: MoveItemParams) => void;
  removeLoop?: (loopId: string) => void;
};

const TrialsContext = createContext<TrialsContextType>({
  trials: [],
  setTrials: () => {},
  selectedTrial: null,
  setSelectedTrial: () => {},
  selectedLoop: null,
  setSelectedLoop: () => {},
  groupTrialsAsLoop: undefined,
  moveTrialOrLoop: undefined,
  removeLoop: undefined,
});

export default TrialsContext;
