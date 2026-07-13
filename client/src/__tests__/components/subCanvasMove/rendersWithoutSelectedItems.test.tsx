import { installTrialsContext, renderSubCanvas } from "./testHarness";
import { beforeEach, describe, expect, it } from "vitest";

describe("SubCanvas empty selection", () => {
  beforeEach(() => {
    installTrialsContext();
  });

  it("renders without toolbar actions when neither a trial nor loop is selected", () => {
    const emptySelection = renderSubCanvas({
      selectedTrial: null,
      selectedLoop: null,
    });

    expect(document.querySelector('[title="Move Trial/Loop"]')).toBeNull();

    emptySelection.unmount();
    renderSubCanvas();

    expect(document.querySelector('[title="Move Trial/Loop"]')).not.toBeNull();
  });
});
