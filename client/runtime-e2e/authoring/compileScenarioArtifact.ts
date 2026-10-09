import { compileLocalExperiment } from "../../src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/compileLocalExperiment";
import { buildExperimentArtifact } from "../../src/pages/ExperimentBuilder/modules/experiment-runtime/experimentArtifact";
import type { ExperimentAuthoringClient } from "../../src/pages/ExperimentBuilder/modules/experiment-authoring/types";
import { scenarioAppearance } from "./scenarioTrialConfiguration";

export async function compileScenarioArtifact(options: {
  apiBaseUrl: string;
  client: ExperimentAuthoringClient;
  experimentId: string;
  customPreInitCode?: string;
  localParams?: Record<string, string>;
  baseCodeOverride?: string;
  appearance?: typeof scenarioAppearance;
}) {
  const getLoopTimeline = async (loopId: string | number) => {
    const graph = await options.client.getGraph(options.experimentId);
    return graph.scopes[String(loopId)]?.items ?? [];
  };
  const generatedCode = await compileLocalExperiment({
    experimentID: options.experimentId,
    apiBaseUrl: options.apiBaseUrl,
    getTrial: (id) => options.client.getTrial(options.experimentId, id),
    getLoop: (id) => options.client.getLoop(options.experimentId, id),
    getLoopTimeline,
    appearance: options.appearance ?? scenarioAppearance,
    customPreInitCode: options.customPreInitCode,
    localParams: options.localParams,
    baseCodeOverride: options.baseCodeOverride,
  });
  return buildExperimentArtifact({
    experimentId: options.experimentId,
    generatedCode,
    apiBaseUrl: options.apiBaseUrl,
    saveConfiguration: true,
    appearance: options.appearance ?? scenarioAppearance,
  });
}
