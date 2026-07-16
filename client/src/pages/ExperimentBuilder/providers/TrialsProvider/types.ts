import { Dispatch, SetStateAction } from "react";
import { Loop, Trial } from "../../components/ConfigurationPanel/types";
import { TimelineItem } from "../../contexts/TrialsContext";

export type LoopMethodsProps = {
  experimentID: string | undefined;
  timeline: TimelineItem[];
  loopTimeline: TimelineItem[];
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  setLoopTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  getTimeline: () => Promise<void>;
  getLoopTimeline: (
    loopId: string | number,
    updateState?: boolean,
    forceRefresh?: boolean,
    throwOnError?: boolean,
  ) => Promise<TimelineItem[]>;
  setSelectedLoop: Dispatch<SetStateAction<Loop | null>>;
  selectedLoop: Loop | null;
};

export type GetLoop = (id: string | number) => Promise<Loop | null>;
export type LoopMethodsWithGetLoop = LoopMethodsProps & { getLoop: GetLoop };

export type TrialMethodsProps = {
  experimentID: string | undefined;
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  setLoopTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  getTimeline: () => Promise<void>;
  selectedTrial: Trial | null;
  setSelectedTrial: (trial: Trial | null) => void;
};
