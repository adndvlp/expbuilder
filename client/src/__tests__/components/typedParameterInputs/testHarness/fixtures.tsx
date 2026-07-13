import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import ArrayInput from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ArrayInput";
import ColorInput from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ColorInput";
import FunctionInput from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/FunctionInput";
import ObjectCoordsInput from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ObjectCoordsInput";
import ObjectInput from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ObjectInput";
import TextInput from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/TextInput";
import WebgazerInput from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/WebgazerInput";
import type { ColumnMappingEntry } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper";

type Mapping = Record<string, ColumnMappingEntry>;
type InputKind =
  | "array"
  | "color"
  | "coords"
  | "function"
  | "object"
  | "text"
  | "webgazer";

function TypedInputHarness({
  kind,
  paramKey = "value",
  type = "string",
  initialValue,
  onSave,
  componentMode = false,
}: {
  kind: InputKind;
  paramKey?: string;
  type?: string;
  initialValue: unknown;
  onSave?: (key: string, value: unknown) => void;
  componentMode?: boolean;
}) {
  const [mapping, setMapping] = useState<Mapping>({
    [paramKey]: { source: "typed", value: initialValue },
  });
  const [localInputValues, setLocalInputValues] = useState<
    Record<string, string>
  >({});
  const entry = mapping[paramKey];

  const common = {
    localInputValues,
    setLocalInputValues,
    setColumnMapping: setMapping,
    paramKey,
    entry,
    label: "Value",
    onSave,
  };

  return (
    <>
      {kind === "array" && (
        <ArrayInput {...common} type={type} componentMode={componentMode} />
      )}
      {kind === "color" && <ColorInput {...common} />}
      {kind === "coords" && (
        <ObjectCoordsInput {...common} componentMode={componentMode} />
      )}
      {kind === "function" && <FunctionInput {...common} />}
      {kind === "object" && (
        <ObjectInput
          onSave={onSave}
          paramKey={paramKey}
          entry={entry}
          setColumnMapping={setMapping}
        />
      )}
      {kind === "text" && (
        <TextInput {...common} componentMode={componentMode} />
      )}
      {kind === "webgazer" && <WebgazerInput {...common} />}
      <output data-testid="mapping">{JSON.stringify(mapping)}</output>
      <output data-testid="locals">{JSON.stringify(localInputValues)}</output>
    </>
  );
}

function readMapping() {
  return JSON.parse(
    screen.getByTestId("mapping").textContent || "{}",
  ) as Mapping;
}

function readLocals() {
  return JSON.parse(screen.getByTestId("locals").textContent || "{}") as Record<
    string,
    string
  >;
}

export {
  ArrayInput,
  ColorInput,
  FunctionInput,
  ObjectCoordsInput,
  ObjectInput,
  TextInput,
  TypedInputHarness,
  WebgazerInput,
  act,
  afterEach,
  describe,
  expect,
  fireEvent,
  it,
  readLocals,
  readMapping,
  render,
  screen,
  useState,
  vi,
};
export type { ColumnMappingEntry, InputKind, Mapping };
