import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("authors paramsOverride and applies it from persisted prior-trial data", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-params-${Date.now()}`);
  await author.createTrial("params-source");
  await author.createTrial("params-target");
  await author.configureButtonTrials(["params-source", "params-target"]);
  await author.configureParamsOverride("params-target", [
    {
      id: 41,
      rules: [
        {
          trialAlias: "params-source",
          column: "response",
          op: "==",
          value: "0",
        },
      ],
      paramsToOverride: {
        stimulus: {
          source: "typed",
          value:
            '<main data-runtime-trial="params-overridden">overridden</main>',
        },
      },
    },
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect(runtime.trial("params-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("params-overridden")).toBeVisible();
  await expect(runtime.trial("params-target")).toHaveCount(0);
  const snapshot = await runtime.snapshot();
  expect(snapshot.events).toContainEqual(
    expect.objectContaining({
      type: "params-override",
      payload: expect.objectContaining({ conditionId: 41 }),
    }),
  );
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("params-source")),
    String(author.id("params-target")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("authors a conditional loop and repeats only while its canonical condition matches", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-conditional-loop-${Date.now()}`);
  await author.createTrial("conditional-item");
  await author.createLoop("conditional-loop", ["conditional-item"]);
  await author.createTrial("after-conditional-loop");
  await author.configureButtonTrials([
    "conditional-item",
    "after-conditional-loop",
  ]);
  await author.configureConditionalLoop("conditional-loop", [
    {
      id: 51,
      rules: [
        {
          trialAlias: "conditional-item",
          column: "trial_index",
          op: "<",
          value: "1",
        },
      ],
    },
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect(runtime.trial("conditional-item")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("conditional-item")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("after-conditional-loop")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const snapshot = await runtime.snapshot();
  const decisions = snapshot.events
    .filter((event) => event.type === "conditional-loop-decision")
    .map((event) => event.payload);
  expect(decisions).toEqual([
    expect.objectContaining({ conditionId: 51, shouldRepeat: true }),
    expect.objectContaining({ conditionId: null, shouldRepeat: false }),
  ]);

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("conditional-item")),
    String(author.id("conditional-item")),
    String(author.id("after-conditional-loop")),
  ]);
  await runtime.assertNoRuntimeFailures();
});
