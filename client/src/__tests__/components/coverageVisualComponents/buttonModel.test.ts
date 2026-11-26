import { describe, expect, it } from "vitest";
import {
  getNaturalButtonSize,
  NATURAL_BUTTON_HEIGHT,
  NATURAL_BUTTON_WIDTH,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ButtonResponse/buttonModel";

describe("getNaturalButtonSize", () => {
  it("returns the current natural minimum for the default font", () => {
    expect(
      getNaturalButtonSize({ choices: ["Button"], fontSize: 14 }),
    ).toEqual({ width: NATURAL_BUTTON_WIDTH, height: NATURAL_BUTTON_HEIGHT });
  });

  it("grows the height with the font size", () => {
    const size = getNaturalButtonSize({ choices: ["Button"], fontSize: 28 });
    expect(size.height).toBe(
      Math.max(NATURAL_BUTTON_HEIGHT, Math.ceil(28 * 1.4 + 12)),
    );
    expect(size.height).toBeGreaterThan(NATURAL_BUTTON_HEIGHT);
  });

  it("grows the width with the longest choice and the font size", () => {
    const size = getNaturalButtonSize({
      choices: ["OK", "A very long choice label"],
      fontSize: 14,
    });
    expect(size.width).toBe(Math.ceil(24 * 14 * 0.55 + 30));
  });

  it("falls back to the default font for invalid values", () => {
    const baseline = getNaturalButtonSize({ choices: ["Button"], fontSize: 14 });
    expect(getNaturalButtonSize({ choices: ["Button"], fontSize: 0 })).toEqual(
      baseline,
    );
    expect(
      getNaturalButtonSize({ choices: ["Button"], fontSize: Number.NaN }),
    ).toEqual(baseline);
  });

  it("keeps image choices at the natural minimum", () => {
    const size = getNaturalButtonSize({
      choices: ["https://example.com/pic.png"],
      fontSize: 28,
    });
    expect(size.width).toBe(NATURAL_BUTTON_WIDTH);
    expect(size.height).toBe(NATURAL_BUTTON_HEIGHT);
  });

  it("falls back to a Button choice when the list is empty", () => {
    expect(getNaturalButtonSize({ choices: [], fontSize: 14 })).toEqual({
      width: NATURAL_BUTTON_WIDTH,
      height: NATURAL_BUTTON_HEIGHT,
    });
  });
});
