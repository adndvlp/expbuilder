import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import useAvailableColumns from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/useAvailableColumns";
import { DynamicPluginPropertyColumn } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/DynamicPluginPropertyColumn";
import ColumnSelector from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/RuleRow/ColumnSelector";
import type {
  ParamsOverrideCondition,
  Trial,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { LoopCondition } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/types";

function getPropValue(prop: unknown) {
  if (prop && typeof prop === "object" && "value" in prop) {
    return (prop as { value: unknown }).value;
  }
  return prop;
}

const dynamicTrial = {
  id: 1,
  type: "trial",
  name: "Dynamic Trial",
  plugin: "plugin-dynamic",
  parameters: {},
  trialCode: "",
  columnMapping: {
    components: {
      source: "typed",
      value: [
        {
          type: "ImageComponent",
          name: { source: "typed", value: "Image_1" },
          stimulus: { source: "typed", value: "cat.png" },
          coordinates: { source: "typed", value: { x: 10, y: 20 } },
        },
        {
          type: "SurveyComponent",
          name: { source: "typed", value: "Survey_1" },
          survey_json: {
            source: "typed",
            value: {
              elements: [{ name: "age", title: "Age" }, { name: "group" }],
            },
          },
        },
      ],
    },
    response_components: {
      source: "typed",
      value: [
        {
          type: "SurveyComponent",
          name: { source: "typed", value: "SurveyResponse_1" },
          survey_json: {
            source: "typed",
            value: { elements: [{ name: "choice", title: "Choice" }] },
          },
        },
        {
          type: "SliderResponseComponent",
          name: { source: "typed", value: "Slider_1" },
        },
        {
          type: "SketchpadComponent",
          name: { source: "typed", value: "Sketch_1" },
        },
        {
          type: "AudioResponseComponent",
          name: { source: "typed", value: "Audio_1" },
        },
      ],
    },
  },
} as Trial;

function renderInTable(ui: React.ReactElement) {
  return render(
    <table>
      <tbody>
        <tr>{ui}</tr>
      </tbody>
    </table>,
  );
}

export {
  ColumnSelector,
  DynamicPluginPropertyColumn,
  React,
  describe,
  dynamicTrial,
  expect,
  fireEvent,
  getPropValue,
  it,
  render,
  renderHook,
  renderInTable,
  screen,
  useAvailableColumns,
  vi,
};
export type { LoopCondition, ParamsOverrideCondition, Trial };
