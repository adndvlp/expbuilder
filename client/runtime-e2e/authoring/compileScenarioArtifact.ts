import { compileLocalExperiment } from "../../src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/compileLocalExperiment";
import { buildExperimentArtifact } from "../../src/pages/ExperimentBuilder/modules/experiment-runtime/experimentArtifact";
import type { ExperimentAuthoringClient } from "../../src/pages/ExperimentBuilder/modules/experiment-authoring/types";
import { scenarioCanvasStyles } from "./scenarioTrialConfiguration";

export async function compileScenarioArtifact(options: {
  apiBaseUrl: string;
  client: ExperimentAuthoringClient;
  experimentId: string;
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
    canvasStyles: scenarioCanvasStyles,
  });
  return buildExperimentArtifact({
    experimentId: options.experimentId,
    generatedCode,
    apiBaseUrl: options.apiBaseUrl,
    saveConfiguration: true,
    canvasStyles: scenarioCanvasStyles,
  });
}
