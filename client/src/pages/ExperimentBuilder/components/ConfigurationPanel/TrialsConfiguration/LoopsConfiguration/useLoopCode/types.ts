export type Trial = {
  trialName: string;
  pluginName: string;
  timelineProps: string;
  mappedJson?: Record<string, any>[];
};

// LoopData: Similar to Loop but with 'items' instead of 'trials' (for processed data)
// and only the properties needed for code generation
export type LoopData = {
  loopName: string; // Equivalent to Loop.name
  loopId: string; // Equivalent to Loop.id
  repetitions: number;
  randomize: boolean;
  orders: boolean;
  stimuliOrders: any[];
  categories: boolean;
  categoryData: any[];
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];
  loopConditions?: LoopCondition[];
  isConditionalLoop?: boolean;
  items: TimelineItem[]; // Recursive: contains processed Trial[] or LoopData[]
  unifiedStimuli: Record<string, any>[];
  isLoop: true; // Discriminator for type guard
};

export type TimelineItem = Trial | LoopData;

export type BranchCondition = {
  id: number;
  rules: Array<{
    prop: string;
    op: string;
    value: string;
  }>;
  nextTrialId: number | string | null;
};

export type LoopConditionRule = {
  trialId: string | number;
  prop: string;
  op: string;
  value: string;
};

export type LoopCondition = {
  id: number;
  rules: LoopConditionRule[];
};

export type RepeatCondition = {
  id: number;
  rules: Array<{
    prop: string;
    op: string;
    value: string;
  }>;
  jumpToTrialId: number | string | null;
};
