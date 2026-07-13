import { Loop, Trial } from "../../components/ConfigurationPanel/types";
import { TimelineItem } from "../../contexts/TrialsContext";

export type GetTrialFn = (id: string | number) => Promise<Trial | null>;
export type GetLoopTimelineFn = (
  loopId: string | number,
  updateState?: boolean,
) => Promise<TimelineItem[]>;
export type GetLoopFn = (id: string | number) => Promise<Loop | null>;

export type UploadedFile = {
  url?: string;
  name?: string;
  type?: string;
};

export type GeneratedTrialResult = {
  code: string;
  mappedJson: Record<string, any>[];
};

export type PluginParameterDefinition = {
  key: string;
  type?: unknown;
  default?: unknown;
};

export type TrialWithCode = {
  trialName: string;
  pluginName?: string;
  timelineProps: string;
  mappedJson?: Record<string, any>[];
  isLoop?: boolean;
  id?: string | number;
  type?: string;
  name?: string;
  plugin?: string;
  order?: number;
};
