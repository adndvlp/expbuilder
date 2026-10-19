import type { BranchCondition, LoopCondition } from "../../../types";

export type { LoopCondition } from "../../../types";

export type Trial = {
  id?: string | number;
  trialName: string;
  pluginName: string;
  timelineProps: string;
  mappedJson?: Record<string, unknown>[];
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  customOnFinish?: string;
};

// LoopData: Similar to Loop but with 'items' instead of 'trials' (for processed data)
// and only the properties needed for code generation
export type LoopData = {
  entryItemId?: string | number | null;
  nextItemId?: string | number | null;
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
  loopConditions?: LoopCondition[];
  isConditionalLoop?: boolean;
  items: TimelineItem[]; // Recursive: contains processed Trial[] or LoopData[]
  unifiedStimuli: Record<string, unknown>[];
  isLoop: true; // Discriminator for type guard
};

export type TimelineItem = Trial | LoopData;
