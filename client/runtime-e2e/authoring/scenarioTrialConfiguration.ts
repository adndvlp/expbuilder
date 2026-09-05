import type { CanvasActionDependencies } from "../../src/pages/ExperimentBuilder/components/Canvas/actions/types";
import type { Trial } from "../../src/pages/ExperimentBuilder/components/ConfigurationPanel/types";

export const scenarioCanvasStyles = {
  backgroundColor: "#ffffff",
  width: 1024,
  height: 768,
  fullScreen: false,
  progressBar: false,
};

export function configureScenarioButtonTrial(
  dependencies: CanvasActionDependencies,
  trialId: string | number,
  alias: string,
  updates: Partial<Trial> = {},
  choices: string[] = ["Continue"],
) {
  const marker = alias.replace(/[^a-zA-Z0-9_-]/g, "-");
  return dependencies.updateTrial(trialId, {
    plugin: "plugin-html-button-response",
    parameters: {},
    columnMapping: {
      stimulus: {
        source: "typed",
        value: `<main data-runtime-trial="${marker}">${alias}</main>`,
      },
      choices: { source: "typed", value: choices },
    },
    ...updates,
  });
}

export function configureScenarioDynamicButtonTrial(
  dependencies: CanvasActionDependencies,
  trialId: string | number,
) {
  return dependencies.updateTrial(trialId, {
    plugin: "plugin-dynamic",
    parameters: {},
    columnMapping: {
      components: { source: "typed", value: [] },
      response_components: {
        source: "typed",
        value: [
          {
            type: "ButtonResponseComponent",
            name: { source: "typed", value: "runtimeButton" },
            choices: { source: "typed", value: ["Continue"] },
            coordinates: { source: "typed", value: { x: 0, y: 0 } },
            width: { source: "typed", value: 180 },
            height: { source: "typed", value: 60 },
          },
        ],
      },
      require_response: { source: "typed", value: true },
      response_ends_trial: { source: "typed", value: true },
      __canvasStyles: { source: "typed", value: scenarioCanvasStyles },
    },
  });
}
