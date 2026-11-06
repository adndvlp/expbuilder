import { expect, it } from "vitest";
import useConfigComponents from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents";

it("serializes user trial parameters and preserves the input mapping", () => {
  const options = {
    toJsPsychCoords: (x: number, y: number) => ({ x, y }),
    columnMapping: {
      trial_duration: { source: "typed", value: 500 },
    },
    appearance: { backgroundColor: "#123456", fullScreen: false, progressBar: true },
  };
  const original = structuredClone(options.columnMapping);
  const config = useConfigComponents(options)([]);
  expect(config).toEqual({ trial_duration: { source: "typed", value: 500 } });
  expect(options.columnMapping).toEqual(original);
});
