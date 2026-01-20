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
  trials: (string | number)[]; // Solo IDs de trials, estructura plana
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
    column: string; // Direct column name (e.g., "ButtonResponseComponent_1_response" or "response")
    op: string;
    value: string;
    // Legacy fields for backward compatibility
    prop?: string;
    fieldType?: string;
    componentIdx?: string;
  }>;
  nextTrialId: number | string | null;
  customParameters?: Record<string, ColumnMappingEntry>;
};

export type RepeatCondition = {
  id: number;
  rules: Array<{
    column: string; // Direct column name
    op: string;
    value: string;
    // Legacy fields for backward compatibility
    prop?: string;
    fieldType?: string;
    componentIdx?: string;
  }>;
  jumpToTrialId: number | string | null;
};

export type LoopConditionRule = {
  trialId: string | number;
  column: string; // Direct column name
  op: string;
  value: string;
  // Legacy fields for backward compatibility
  prop?: string;
  fieldType?: string;
  componentIdx?: string;
};

export type LoopCondition = {
  id: number;
  rules: LoopConditionRule[];
};

export type ParamsOverrideRule = {
  trialId: string | number;
  column: string; // Direct column name
  op: string;
  value: string;
  // Legacy fields for backward compatibility
  prop?: string;
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

  // Loop context - assigned when trial is inside a loop
  parentLoopId?: string | null;
};

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
