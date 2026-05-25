import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCsvMapper } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/useCsvMapper";

const fieldGroups = {
  general: [
    { key: "stimulus", label: "Stimulus", type: "html_string", default: "<p>Default</p>" },
    { key: "trial_duration", label: "Duration", type: "number", default: 1000 },
    { key: "response_ends_trial", label: "Ends", type: "boolean", default: true },
    { key: "choices", label: "Choices", type: "string_array", default: ["space"] },
    { key: "numbers", label: "Numbers", type: "number_array", default: [] },
    { key: "flags", label: "Flags", type: "boolean_array", default: [] },
    { key: "coordinates", label: "Coordinates", type: "object", default: { x: 0, y: 0 } },
    { key: "survey_json", label: "Survey", type: "object", default: {} },
    { key: "button_html", label: "Button HTML", type: "function", default: "" },
    { key: "calibration_points", label: "Calibration", type: "number_array", default: [] },
  ],
};

function setup() {
  return renderHook(() => useCsvMapper({ fieldGroups })).result.current;
}

describe("useCsvMapper", () => {
  it("falls back to explicit defaults, field defaults and typed values without losing falsy values", () => {
    const { getColumnValue } = setup();

    expect(getColumnValue(undefined, undefined, "explicit", "stimulus")).toBe(
      "explicit",
    );
    expect(getColumnValue(undefined, undefined, undefined, "trial_duration")).toBe(
      1000,
    );
    expect(
      getColumnValue(
        { source: "none", value: null },
        undefined,
        undefined,
        "stimulus",
      ),
    ).toBe("<p>Default</p>");
    expect(
      getColumnValue(
        { source: "typed", value: 0 },
        undefined,
        undefined,
        "trial_duration",
      ),
    ).toBe(0);
    expect(
      getColumnValue(
        { source: "typed", value: false },
        undefined,
        undefined,
        "response_ends_trial",
      ),
    ).toBe(false);
  });

  it("casts CSV scalar values by parameter type", () => {
    const { getColumnValue } = setup();
    const row = {
      duration_col: "2500",
      boolean_col: "0",
      button_col: "(choice) => `<button>${choice}</button>`",
    };

    expect(
      getColumnValue(
        { source: "csv", value: "duration_col" },
        row,
        undefined,
        "trial_duration",
      ),
    ).toBe(2500);
    expect(
      getColumnValue(
        { source: "csv", value: "boolean_col" },
        row,
        undefined,
        "response_ends_trial",
      ),
    ).toBe(false);
    expect(
      getColumnValue(
        { source: "csv", value: "button_col" },
        row,
        undefined,
        "button_html",
      ),
    ).toBe("(choice) => `<button>${choice}</button>`");
  });

  it("casts CSV arrays while preserving uncastable items", () => {
    const { getColumnValue } = setup();
    const row = {
      choices_col: "left, right, space",
      numbers_col: "1, 2.5, bad",
      flags_col: "true, 0, maybe",
    };

    expect(
      getColumnValue(
        { source: "csv", value: "choices_col" },
        row,
        undefined,
        "choices",
      ),
    ).toEqual(["left", "right", "space"]);
    expect(
      getColumnValue(
        { source: "csv", value: "numbers_col" },
        row,
        undefined,
        "numbers",
      ),
    ).toEqual([1, 2.5, "bad"]);
    expect(
      getColumnValue(
        { source: "csv", value: "flags_col" },
        row,
        undefined,
        "flags",
      ),
    ).toEqual([true, false, "maybe"]);
  });

  it("parses CSV object fields as coordinates or JSON", () => {
    const { getColumnValue } = setup();
    const row = {
      coord_col: "12.5, 33",
      survey_col: '{"title":"Survey","elements":[{"name":"q1"}]}',
    };

    expect(
      getColumnValue(
        { source: "csv", value: "coord_col" },
        row,
        undefined,
        "coordinates",
      ),
    ).toEqual({ x: 12.5, y: 33 });
    expect(
      getColumnValue(
        { source: "csv", value: "survey_col" },
        row,
        undefined,
        "survey_json",
      ),
    ).toEqual({ title: "Survey", elements: [{ name: "q1" }] });
  });

  it("parses WebGazer point CSV strings into coordinate arrays", () => {
    const { getColumnValue } = setup();
    const row = {
      points_col: "[20,20], [80,20], [50,50]",
    };

    expect(
      getColumnValue(
        { source: "csv", value: "points_col" },
        row,
        undefined,
        "calibration_points",
      ),
    ).toEqual([
      [20, 20],
      [80, 20],
      [50, 50],
    ]);
  });

  it("uses field defaults when a mapped CSV column is missing from the row", () => {
    const { getColumnValue } = setup();

    expect(
      getColumnValue(
        { source: "csv", value: "missing_col" },
        {},
        undefined,
        "choices",
      ),
    ).toEqual(["space"]);
  });
});
