import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrialCode } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/useTrialCode";
import useLoopCode from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import type { ColumnMappingEntry } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

function getColumnValue(
  mapping: ColumnMappingEntry | undefined,
  row?: Record<string, unknown>,
  defaultValue?: unknown,
  key?: string,
) {
  if (!mapping || mapping.source === "none") return defaultValue ?? "";
  if (mapping.source === "typed") return mapping.value ?? "";
  if (mapping.source === "csv") {
    const column = typeof mapping.value === "string" ? mapping.value : key;
    return column && row && column in row ? row[column] : (defaultValue ?? "");
  }
  return defaultValue ?? "";
}

export {
  beforeEach,
  describe,
  expect,
  getColumnValue,
  it,
  normalize,
  useLoopCode,
  useTrialCode,
  vi,
};
export type { ColumnMappingEntry };
