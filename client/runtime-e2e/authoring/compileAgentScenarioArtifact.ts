import { generateLoopCode } from "../../../server/agent/codegen/loop.js";
import { generateTrialCode } from "../../../server/agent/codegen/trial.js";
import { buildExperimentArtifact } from "../../src/pages/ExperimentBuilder/modules/experiment-runtime/experimentArtifact";
import type { ScenarioAuthor } from "./ScenarioAuthor";

export async function compileAgentScenarioArtifact(author: ScenarioAuthor) {
  const graph = await author.assertHealthyGraph();
  const allItems = [graph.root, ...Object.values(graph.scopes)].flatMap(scope => scope.items);
  const trials = await Promise.all(allItems.filter(item => item.type === "trial").map(
    item => author.client.getTrial(author.experimentId, item.id),
  ));
  const loops = await Promise.all(allItems.filter(item => item.type === "loop").map(
    item => author.client.getLoop(author.experimentId, item.id),
  ));
  const code = graph.root.items.map(item => item.type === "loop"
    ? generateLoopCode(loops.find(loop => String(loop.id) === String(item.id)), { trials, loops }, null)
    : generateTrialCode(trials.find(trial => String(trial.id) === String(item.id)), false).code,
  ).join("\n");
  return buildExperimentArtifact({
    experimentId: author.experimentId,
    apiBaseUrl: author.apiBaseUrl,
    generatedCode: `
      const jsPsych = initJsPsych({ on_finish: function() {
        window.agentRows = jsPsych.data.get().values();
        document.body.innerHTML = '<p>Agent complete</p>';
      }});
      const timeline = [];
      window.nextTrialId = null;
      window.skipRemaining = false;
      window.branchingActive = false;
      window.branchCustomParameters = null;
      ${code}
      jsPsych.run(timeline);
    `,
  });
}
