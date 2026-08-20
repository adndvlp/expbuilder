import { afterEach, describe, expect, it } from "vitest";
import { loadingOverlayCode } from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/LoadingOverlay";

type OverlayRuntime = {
  showSuccess: () => void;
};

function createOverlayRuntime(): OverlayRuntime {
  const factory = new Function(`
    ${loadingOverlayCode()}
    return { showSuccess: _showSuccess };
  `) as () => OverlayRuntime;

  return factory();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("loading overlay", () => {
  it("removes the final trial visual surfaces before showing success", () => {
    document.body.innerHTML = `
      <div id="jspsych-dynamic-visual-bridge"><canvas></canvas></div>
      <div id="jspsych-dynamic-persistent-visual"><canvas></canvas></div>
      <div id="unrelated-content"></div>
    `;

    const { showSuccess } = createOverlayRuntime();
    showSuccess();

    expect(document.getElementById("jspsych-dynamic-visual-bridge")).toBeNull();
    expect(
      document.getElementById("jspsych-dynamic-persistent-visual"),
    ).toBeNull();
    expect(document.getElementById("unrelated-content")).not.toBeNull();
    expect(
      document.getElementById("jspsych-loading-overlay")?.textContent,
    ).toContain("Experiment complete. Thank you!");
  });
});
