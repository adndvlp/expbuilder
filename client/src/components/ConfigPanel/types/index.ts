export type ColumnValueType = "csv" | "typed" | "none";

export type coordinates = { x: number; y: number };

export type ColumnMappingEntry = {
  source: ColumnValueType;
  value: string | number | boolean | any[] | coordinates | undefined | null;
};

export type ColumnMapping = Record<string, ColumnMappingEntry>;

export interface Trial {
  id: number;
  type: string;
  name: string;
  plugin?: string;
  parameters: Record<string, any>;
  trialCode: string;
  columnMapping?: Record<string, any>;
  csvJson?: any[];
  csvColumns?: string[];
  editPluginMode?: boolean;
}

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
