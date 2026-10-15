import { expect, it } from "vitest";
import useConfigComponents from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents";

it("does not save the global appearance inside a trial or retain an old copy", () => {
  const options = {
    toJsPsychCoords: (x: number, y: number) => ({ x, y }),
    columnMapping: {
      __canvasStyles: { source: "typed", value: { backgroundColor: "#ff0000" } },
      trial_duration: { source: "typed", value: 500 },
    },
    appearance: { backgroundColor: "#123456", fullScreen: false, progressBar: true },
  };
  const original = structuredClone(options.columnMapping);
  const config = useConfigComponents(options)([]);
  expect(config).not.toHaveProperty("__canvasStyles");
  expect(config.trial_duration).toEqual({ source: "typed", value: 500 });
  expect(options.columnMapping).toEqual(original);
});
