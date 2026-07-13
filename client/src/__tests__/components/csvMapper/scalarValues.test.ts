import { describe, expect, it } from "vitest";
import { setupCsvMapper } from "./testHarness";

describe("useCsvMapper defaults, scalars and arrays", () => {
  it("falls back to explicit defaults, field defaults and typed values without losing falsy values", () => {
    const { getColumnValue } = setupCsvMapper();

    expect(getColumnValue(undefined, undefined, "explicit", "stimulus")).toBe(
      "explicit",
    );
    expect(
      getColumnValue(undefined, undefined, undefined, "trial_duration"),
    ).toBe(1000);
    expect(getColumnValue(undefined, undefined, undefined, "unknown_key")).toBe(
      "",
    );
    expect(getColumnValue(undefined, undefined, undefined)).toBe("");
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
    expect(
      getColumnValue({ source: "typed", value: null }, undefined, undefined),
    ).toBe("");
    expect(
      getColumnValue(
        { source: "typed", value: null },
        undefined,
        undefined,
        "stimulus",
      ),
    ).toBe("<p>Default</p>");
  });

  it("casts CSV scalar values by parameter type", () => {
    const { getColumnValue } = setupCsvMapper();
    const row = {
      duration_col: "2500",
      invalid_duration_col: "fast",
      boolean_col: "0",
      boolean_true_col: "1",
      boolean_raw_col: "maybe",
      button_col: "(choice) => `<button>${choice}</button>`",
      stimulus_col: "<strong>Hello</strong>",
      0: "numeric column stimulus",
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
        { source: "csv", value: "invalid_duration_col" },
        row,
        undefined,
        "trial_duration",
      ),
    ).toBe("fast");
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
        { source: "csv", value: "boolean_true_col" },
        row,
        undefined,
        "response_ends_trial",
      ),
    ).toBe(true);
    expect(
      getColumnValue(
        { source: "csv", value: "boolean_raw_col" },
        row,
        undefined,
        "response_ends_trial",
      ),
    ).toBe("maybe");
    expect(
      getColumnValue(
        { source: "csv", value: "button_col" },
        row,
        undefined,
        "button_html",
      ),
    ).toBe("(choice) => `<button>${choice}</button>`");
    expect(
      getColumnValue(
        { source: "csv", value: "stimulus_col" },
        row,
        undefined,
        "stimulus",
      ),
    ).toBe("<strong>Hello</strong>");
    expect(
      getColumnValue({ source: "csv", value: 0 }, row, undefined, "stimulus"),
    ).toBe("numeric column stimulus");
  });

  it("casts CSV arrays while preserving uncastable items", () => {
    const { getColumnValue } = setupCsvMapper();
    const row = {
      choices_col: "left, right, space",
      numbers_col: "1, 2.5, bad",
      flags_col: "true, 0, maybe",
      raw_numbers_col: [1, 2, 3],
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
    expect(
      getColumnValue(
        { source: "csv", value: "raw_numbers_col" },
        row,
        undefined,
        "numbers",
      ),
    ).toEqual([1, 2, 3]);
  });
});
