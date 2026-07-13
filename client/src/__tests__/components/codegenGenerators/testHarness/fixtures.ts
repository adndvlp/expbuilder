import { describe, expect, it, vi } from "vitest";
import MappedJson from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/MappedJson";
import { generateBranchConditionsCode } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/branchConditionsGenerator";
import { generateConditionalFunctionCode } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/conditionalFunctionGenerator";
import { generateOnFinishCode } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator";
import { generateOnStartCode } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onStartGenerator";
import { generateParamsOverrideCode } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/paramsOverrideGenerator";
import { generateRepeatConditionsCode } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/repeatConditionsGenerator";
import type {
  BranchCondition,
  ColumnMappingEntry,
  ParamsOverrideCondition,
  RepeatCondition,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

function getVarName(baseName: string) {
  return `loop_1_${baseName}`;
}

function getColumnValue(
  mapping: ColumnMappingEntry | undefined,
  row?: Record<string, unknown>,
  defaultValue?: unknown,
  key?: string,
) {
  if (!mapping || mapping.source === "none") return defaultValue;
  if (mapping.source === "typed") return mapping.value;
  if (mapping.source === "csv") {
    const column = typeof mapping.value === "string" ? mapping.value : key;
    return column && row && column in row ? row[column] : defaultValue;
  }
  return defaultValue;
}

export {
  MappedJson,
  describe,
  expect,
  generateBranchConditionsCode,
  generateConditionalFunctionCode,
  generateOnFinishCode,
  generateOnStartCode,
  generateParamsOverrideCode,
  generateRepeatConditionsCode,
  getColumnValue,
  getVarName,
  it,
  normalize,
  vi,
};
export type {
  BranchCondition,
  ColumnMappingEntry,
  ParamsOverrideCondition,
  RepeatCondition,
};
