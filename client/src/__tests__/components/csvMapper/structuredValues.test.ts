import { describe, expect, it } from "vitest";
import { setupCsvMapper } from "./testHarness";

describe("useCsvMapper structured values and fallbacks", () => {
  it("parses CSV object fields as coordinates or JSON", () => {
    const { getColumnValue } = setupCsvMapper();
    const row = {
      coord_col: "12.5, 33",
      invalid_coord_col: "12.5, nope",
      short_coord_col: "12.5",
      survey_col: '{"title":"Survey","elements":[{"name":"q1"}]}',
      invalid_survey_col: "{not json",
      raw_survey_col: { title: "Already parsed" },
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
    expect(
      getColumnValue(
        { source: "csv", value: "invalid_coord_col" },
        row,
        undefined,
        "coordinates",
      ),
    ).toBe("12.5, nope");
    expect(
      getColumnValue(
        { source: "csv", value: "short_coord_col" },
        row,
        undefined,
        "coordinates",
      ),
    ).toBe(12.5);
    expect(
      getColumnValue(
        { source: "csv", value: "invalid_survey_col" },
        row,
        undefined,
        "survey_json",
      ),
    ).toBe("{not json");
    expect(
      getColumnValue(
        { source: "csv", value: "raw_survey_col" },
        row,
        undefined,
        "survey_json",
      ),
    ).toEqual({ title: "Already parsed" });
  });

  it("parses WebGazer point CSV strings into coordinate arrays", () => {
    const { getColumnValue } = setupCsvMapper();
    const row = {
      points_col: "[20,20], [80,20], [50,50]",
      mixed_points_col: "[left,2], [3,right]",
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
    expect(
      getColumnValue(
        { source: "csv", value: "mixed_points_col" },
        row,
        undefined,
        "validation_points",
      ),
    ).toEqual([
      ["left", 2],
      [3, "right"],
    ]);
  });

  it("uses field defaults when a mapped CSV column is missing from the row", () => {
    const { getColumnValue } = setupCsvMapper();

    expect(
      getColumnValue(
        { source: "csv", value: "missing_col" },
        {},
        undefined,
        "choices",
      ),
    ).toEqual(["space"]);
    expect(
      getColumnValue(
        { source: "csv", value: "present_col" },
        { present_col: "raw" },
        undefined,
        "missing_param",
      ),
    ).toBe("raw");
  });

  it("falls back when CSV mapping cannot be resolved", () => {
    const { getColumnValue } = setupCsvMapper();

    expect(
      getColumnValue(
        { source: "csv", value: "duration_col" },
        undefined,
        "fallback",
        "trial_duration",
      ),
    ).toBe("fallback");
    expect(
      getColumnValue(
        { source: "csv", value: "duration_col" },
        { duration_col: "100" },
        undefined,
      ),
    ).toBe("");
    expect(
      getColumnValue(
        { source: "csv", value: true },
        { true: "unused" },
        "fallback",
        "stimulus",
      ),
    ).toBe("fallback");
    expect(
      getColumnValue(
        { source: "plugin" as any, value: "duration_col" },
        {},
        undefined,
        "trial_duration",
      ),
    ).toBe(1000);
    expect(
      getColumnValue({ source: "plugin" as any, value: "duration_col" }),
    ).toBe("");
  });
});
