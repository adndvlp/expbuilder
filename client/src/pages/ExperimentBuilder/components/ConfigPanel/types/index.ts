export type ColumnValueType = "csv" | "typed" | "none";

export type coordinates = { x: number; y: number };

export type ColumnMappingEntry = {
  source: ColumnValueType;
  value: string | number | boolean | any[] | coordinates | undefined | null;
};

export type ColumnMapping = Record<string, ColumnMappingEntry>;

export interface Loop {
  id: string;
  name: string;
  repetitions: number;
  randomize: boolean;
  orders: boolean;
  stimuliOrders: any[];
  orderColumns: string[];
  categories: boolean;
  categoryColumn: string;
  categoryData: any[];
  trials: TrialOrLoop[];
  code: string;
  csvJson?: any[];
  csvColumns?: string[];
  branches?: Array<string | number>;
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];
  loopConditions?: LoopCondition[];
  isConditionalLoop?: boolean;
}

export type BranchCondition = {
  id: number;
  rules: Array<{
    prop: string;
    op: string;
    value: string;
  }>;
  nextTrialId: number | string | null;
  customParameters?: Record<string, ColumnMappingEntry>;
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

export type LoopConditionRule = {
  trialId: string | number;
  prop: string;
  op: string;
  value: string;
  fieldType?: string;
  componentIdx?: string;
};

export type LoopCondition = {
  id: number;
  rules: LoopConditionRule[];
};

export type ParamsOverrideRule = {
  trialId: string | number;
  prop: string;
  op: string;
  value: string;
  fieldType?: string;
  componentIdx?: string;
};

export type ParamsOverrideCondition = {
  id: number;
  rules: ParamsOverrideRule[];
  paramsToOverride: Record<string, ColumnMappingEntry>;
};

export type Trial = {
  id: number;
  type: string;
  name: string;
  plugin?: string;
  parameters: Record<string, any>;
  trialCode: string;
  columnMapping?: Record<string, any>;
  csvJson?: any[];
  csvColumns?: string[];
  csvFromLoop?: boolean;

  orders?: boolean;
  stimuliOrders?: any[];
  orderColumns?: string[];
  categories?: boolean;
  categoryColumn?: string;
  categoryData?: any[];

  editPluginMode?: boolean;

  branches?: Array<string | number>;
  branchConditions?: BranchCondition[];

  repeatConditions?: RepeatCondition[];

  paramsOverride?: ParamsOverrideCondition[];
};

export type TrialOrLoop = Trial | Loop;

export type MoveItemParams = {
  dragged: { type: "trial" | "loop"; id: string | number };
  target: { type: "trial" | "loop"; id: string | number | null };
  position: "before" | "after" | "inside";
};

export type FieldType =
  | "string"
  | "html_string"
  | "number"
  | "boolean"
  | "function"
  | "coordinates"
  | "object"
  | "string_array"
  | "number_array"
  | "boolean_array"
  | "undefined"
  | "null";

export type DefaultValue =
  | string
  | number
  | boolean
  | null
  | object
  | undefined
  | Array<[]>
  | string[];

export interface FieldDefinition {
  label: string;
  key: string;
  type: FieldType;
  default: DefaultValue;
}

export interface DataDefinition {
  label: string;
  key: string;
  type: FieldType;
}
