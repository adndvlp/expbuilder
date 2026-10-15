import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

for (const chain of [false, true]) {
  test(`[RUNTIME-LOOP-SIBLING-ENTRY] client enters the exact trial three loops deep with parameters and honors its selected exit (chain=${chain})`, async ({
    page,
  }) => {
    const author = new ScenarioAuthor(runtimeApiBaseUrl);
    await author.createExperiment(`runtime-sibling-client-${Date.now()}`);
    for (const alias of [
      "entry-source",
      "entry-source-skipped",
      "entry-before",
      "entry-target",
      "entry-after",
      "entry-final",
    ]) {
      await author.createTrial(alias);
    }
    await author.createLoop("entry-source-loop", [
      "entry-source",
      "entry-source-skipped",
    ]);
    await author.createLoop("entry-target-loop", [
      "entry-before",
      "entry-target",
      "entry-after",
      "entry-final",
    ]);
    await author.createLoop("entry-target-outer", ["entry-target-loop"]);
    await author.createLoop("entry-target-outermost", ["entry-target-outer"]);
    for (const alias of [
      "entry-source-loop",
      "entry-target-loop",
      "entry-target-outer",
      "entry-target-outermost",
    ]) {
      await author.client.updateLoop(author.experimentId, author.id(alias), {
        csvJson: [{ row: 1 }, { row: 2 }],
        repetitions: 2,
      });
    }
    await author.configureButtonTrials([
      "entry-source",
      "entry-source-skipped",
      "entry-before",
      "entry-target",
      "entry-after",
      "entry-final",
    ]);
    await author.configureButtonTrial("entry-final", { defaultNextTrialId: "FINISH_EXPERIMENT" });
    await author.configureButtonTrial("entry-source", {
          defaultNextTrialId: author.id("entry-target"),
      branches: [author.id("entry-target")],
    });
    await author.configureBranchConditions("entry-source", [
      {
        id: 201,
        rules: [{ column: "response", op: "==", value: "0" }],
        nextTrialAlias: "entry-target",
        customParameters: {
          stimulus: {
            source: "typed",
            value:
              '<main data-runtime-trial="entry-target">received payload</main>',
          },
        },
      },
    ]);
    if (chain) {
      await author.configureBranchConditions("entry-target", [{
        id: 202, rules: [{ column: "response", op: "==", value: "0" }], nextTrialAlias: "entry-final",
      }]);
    } else {
      await author.configureButtonTrial("entry-target", { defaultNextTrialId: "FINISH_EXPERIMENT" });
    }
    const graph = await author.assertHealthyGraph();
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: author.id("entry-source"),
          targetId: author.id("entry-target"),
        }),
      ]),
    );
    const artifact = await author.compileAndBuild();
    const runtime = new RuntimeObserver(page);
    await page.goto(artifact.experimentUrl);
    await expect(runtime.trial("entry-source")).toBeVisible();
    await runtime.continue();
    await expect(runtime.trial("entry-target")).toHaveText("received payload");
    await runtime.continue();
    if (chain) {
      await expect(runtime.trial("entry-final")).toBeVisible();
      await runtime.continue();
    }
    let data;

    await expect(
      page.getByText("Experiment complete. Thank you!"),
    ).toBeVisible();
    data = (
      await loadPersistedSession(author.experimentId, await runtime.sessionId())
    ).session.data;

    expect(builderIds(data)).toEqual([
      String(author.id("entry-source")),
      String(author.id("entry-target")),
      ...(chain ? [String(author.id("entry-final"))] : []),
    ]);
    await runtime.assertNoRuntimeFailures();
  });
}
