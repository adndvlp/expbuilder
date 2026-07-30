import type { Dispatch, SetStateAction } from "react";
import type { Loop, Trial } from "../../components/ConfigurationPanel/types";
import type {
  LoopTimelineCache,
  LoopTimelineLoadOptions,
  TimelineItem,
} from "../../contexts/TrialsContext";
import type { UpdateLoopTimelineItems } from "./hooks/useLoopTimelineCache";

export type LoopMethodsProps = {
  experimentID: string | undefined;
  timeline: TimelineItem[];
  loopTimelineCache: LoopTimelineCache;
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  updateLoopTimelineItems: UpdateLoopTimelineItems;
  getTimeline: () => Promise<void>;
  getLoopTimeline: (
    loopId: string | number,
    options?: LoopTimelineLoadOptions,
  ) => Promise<TimelineItem[]>;
  setSelectedLoop: Dispatch<SetStateAction<Loop | null>>;
  selectedLoop: Loop | null;
  getSelectedLoop: () => Loop | null;
};

export type GetLoop = (id: string | number) => Promise<Loop | null>;
export type LoopMethodsWithGetLoop = LoopMethodsProps & { getLoop: GetLoop };

export type TrialMethodsProps = {
  experimentID: string | undefined;
  timeline: TimelineItem[];
  loopTimelineCache: LoopTimelineCache;
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  updateLoopTimelineItems: UpdateLoopTimelineItems;
  getTimeline: () => Promise<void>;
  getLoopTimeline: LoopMethodsProps["getLoopTimeline"];
  getSelectedTrial: () => Trial | null;
  setSelectedTrial: Dispatch<SetStateAction<Trial | null>>;
};
