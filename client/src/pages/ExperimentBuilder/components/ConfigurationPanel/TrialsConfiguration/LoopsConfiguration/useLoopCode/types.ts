export type Trial = {
  trialName: string;
  pluginName: string;
  timelineProps: string;
  mappedJson?: Record<string, any>[];
};

// LoopData: Similar a Loop pero con 'items' en lugar de 'trials' (para datos procesados)
// y solo las propiedades necesarias para generación de código
export type LoopData = {
  loopName: string; // Equivalente a Loop.name
  loopId: string; // Equivalente a Loop.id
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
  items: TimelineItem[]; // Recursivo: contiene Trial[] o LoopData[] procesados
  unifiedStimuli: Record<string, any>[];
  isLoop: true; // Discriminador para type guard
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
