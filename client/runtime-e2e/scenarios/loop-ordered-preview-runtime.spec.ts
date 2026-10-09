import { expect, test } from "@playwright/test";
import { generateLoopCode } from "../../src/pages/ExperimentBuilder/utils/codegen/generateLoopCode";
import { buildExperimentArtifact } from "../../src/pages/ExperimentBuilder/modules/experiment-runtime/experimentArtifact";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { runtimeApiBaseUrl } from "../support/session";

for (const scenario of [
  { name: "without a participant number", participantNumber: undefined, rowCount: 3, orders: [[2, 1, 0]] },
  { name: "with an empty participant order", participantNumber: 1, rowCount: 480, orders: [[]] },
]) {
test(`an ordered dynamic loop runs ${scenario.rowCount} rows ${scenario.name}`, async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-ordered-preview-${Date.now()}`);
  await author.createTrial("Behavioral Statements");
  await author.createLoop("ordered-loop", ["Behavioral Statements"]);
  await author.configureDynamicButtonTrial("Behavioral Statements");
  const trial = await author.client.getTrial(author.experimentId, author.id("Behavioral Statements"));
  await author.client.updateTrial(author.experimentId, trial.id, {
    csvFromLoop: true,
    columnMapping: {
      ...trial.columnMapping,
      trial_duration: { source: "typed", value: 1 },
      __canvasStyles: { source: "typed", value: { width: 1440, height: 900 } },
    },
  });
  await author.client.updateLoop(author.experimentId, author.id("ordered-loop"), {
    csvJson: Array.from({ length: scenario.rowCount }, (_, row) => ({ row })), repetitions: 1,
    orders: true, stimuliOrders: scenario.orders,
  });
  const loop = await author.client.getLoop(author.experimentId, author.id("ordered-loop"));
  const graph = await author.assertHealthyGraph();
  const code = await generateLoopCode(
    loop, author.experimentId, [],
    id => author.client.getTrial(author.experimentId, id),
    async id => graph.scopes[String(id)].items,
    id => author.client.getLoop(author.experimentId, id),
    { apiBaseUrl: runtimeApiBaseUrl },
  );
  const artifact = await buildExperimentArtifact({
    experimentId: author.experimentId, apiBaseUrl: runtimeApiBaseUrl,
    generatedCode: `
      ${scenario.participantNumber === undefined ? "" : `const participantNumber = ${scenario.participantNumber};`}
      const jsPsych = initJsPsych({ on_finish: function() {
        window.previewRows = jsPsych.data.get().values();
        document.body.innerHTML = '<p>Preview complete</p>';
      }});
      const timeline = [];
      window.branchingActive = false;
      window.skipRemaining = false;
      ${code}
      jsPsych.run(timeline);
    `,
  });
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(page.getByText("Preview complete")).toBeVisible();
  const rows = await page.evaluate(() => (window as unknown as { previewRows: Record<string, unknown>[] }).previewRows);
  expect(rows).toHaveLength(scenario.rowCount);
  expect(rows.map(row => String(row.trial_id))).toEqual(Array(scenario.rowCount).fill(String(trial.id)));
  await runtime.assertNoRuntimeFailures();
});
}
