import { renderHook } from "@testing-library/react";
import { useCsvMapper } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/useCsvMapper";

export const fieldGroups = {
  general: [
    {
      key: "stimulus",
      label: "Stimulus",
      type: "html_string",
      default: "<p>Default</p>",
    },
    { key: "trial_duration", label: "Duration", type: "number", default: 1000 },
    {
      key: "response_ends_trial",
      label: "Ends",
      type: "boolean",
      default: true,
    },
    {
      key: "choices",
      label: "Choices",
      type: "string_array",
      default: ["space"],
    },
    { key: "numbers", label: "Numbers", type: "number_array", default: [] },
    { key: "flags", label: "Flags", type: "boolean_array", default: [] },
    {
      key: "coordinates",
      label: "Coordinates",
      type: "object",
      default: { x: 0, y: 0 },
    },
    { key: "survey_json", label: "Survey", type: "object", default: {} },
    { key: "button_html", label: "Button HTML", type: "function", default: "" },
    {
      key: "calibration_points",
      label: "Calibration",
      type: "number_array",
      default: [],
    },
    {
      key: "validation_points",
      label: "Validation",
      type: "number_array",
      default: [],
    },
  ],
};

export function setupCsvMapper() {
  return renderHook(() => useCsvMapper({ fieldGroups })).result.current;
}
