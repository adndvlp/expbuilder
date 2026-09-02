import type {
  BranchCondition,
  LoopCondition,
  RepeatCondition,
} from "../../../types";

export type { BranchCondition, LoopCondition, RepeatCondition };

export type Trial = {
  id?: string | number;
  trialName: string;
  pluginName: string;
  timelineProps: string;
  mappedJson?: Record<string, unknown>[];
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];
  customOnFinish?: string;
};

// LoopData: Similar to Loop but with 'items' instead of 'trials' (for processed data)
// and only the properties needed for code generation
export type LoopData = {
  id?: string | number;
  name?: string;
  loopName: string; // Equivalent to Loop.name
  loopId: string; // Equivalent to Loop.id
  timelineProps?: string;
  repetitions: number;
  randomize: boolean;
  orders: boolean;
  stimuliOrders: unknown[];
  categories: boolean;
  categoryData: unknown[];
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];
  loopConditions?: LoopCondition[];
  isConditionalLoop?: boolean;
  items: TimelineItem[]; // Recursive: contains processed Trial[] or LoopData[]
  unifiedStimuli: Record<string, unknown>[];
  isLoop: true; // Discriminator for type guard
};

export type TimelineItem = Trial | LoopData;
