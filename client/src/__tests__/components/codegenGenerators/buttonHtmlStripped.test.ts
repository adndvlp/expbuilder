import { describe, expect, it } from "vitest";
import { processDynamicComponents } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/services/processDynamicComponents";

describe("processDynamicComponents button_html eradication", () => {
  it("strips button_html left over in legacy saved trials", () => {
    const result = processDynamicComponents(
      [
        {
          type: "ButtonResponseComponent",
          choices: { source: "typed", value: ["Yes", "No"] },
          button_html: {
            source: "typed",
            value: "(choice) => `<button>${choice}</button>`",
          },
        },
      ],
      undefined,
      [],
    );

    expect(result[0]).toEqual({
      type: "ButtonResponseComponent",
      choices: ["Yes", "No"],
    });
    expect("button_html" in result[0]).toBe(false);
  });

  it("leaves components without button_html untouched", () => {
    const result = processDynamicComponents(
      [
        {
          type: "ButtonResponseComponent",
          choices: { source: "typed", value: ["Go"] },
        },
      ],
      undefined,
      [],
    );

    expect(result[0]).toEqual({
      type: "ButtonResponseComponent",
      choices: ["Go"],
    });
  });
});
