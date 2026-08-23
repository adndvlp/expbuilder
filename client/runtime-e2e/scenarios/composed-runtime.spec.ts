import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("moves trials through the canvas action and executes the generated order", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-move-${Date.now()}`);
  await author.createTrial("move-first");
  await author.createTrial("move-second");
  await author.createTrial("move-third");
  await author.configureButtonTrials([
    "move-first",
    "move-second",
    "move-third",
  ]);

  const graph = await author.moveAfter("move-third", "move-first");
  expect(graph.root.items.map((item) => String(item.id))).toEqual([
    String(author.id("move-first")),
    String(author.id("move-third")),
    String(author.id("move-second")),
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  for (const alias of ["move-first", "move-third", "move-second"]) {
    await expect(runtime.trial(alias)).toBeVisible();
    await runtime.continue();
  }
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("move-first")),
    String(author.id("move-third")),
    String(author.id("move-second")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("combines a conditional nested-loop exit with params override", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-composed-${Date.now()}`);
  await author.createTrial("composed-source");
  await author.createTrial("inner-skipped");
  await author.createLoop("composed-inner", [
    "composed-source",
    "inner-skipped",
  ]);
  await author.createTrial("outer-skipped");
  await author.createLoop("composed-outer", [
    "composed-inner",
    "outer-skipped",
  ]);
  await author.addLoopExitBranch("composed-source", "composed-root-exit");
  await author.configureButtonTrials([
    "composed-source",
    "inner-skipped",
    "outer-skipped",
    "composed-root-exit",
  ]);
  await author.configureBranchConditions("composed-source", [
    {
      id: 81,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "composed-root-exit",
    },
  ]);
  await author.configureParamsOverride("composed-root-exit", [
    {
      id: 82,
      rules: [{
        trialAlias: "composed-source",
        column: "response",
        op: "==",
        value: "0",
      }],
      paramsToOverride: {
        stimulus: {
          source: "typed",
          value: '<main data-runtime-trial="composed-overridden">exit</main>',
        },
      },
    },
  ]);

  const graph = await author.assertHealthyGraph();
  const exitEdge = graph.edges.find((edge) =>
    String(edge.sourceId) === String(author.id("composed-source")) &&
    String(edge.targetId) === String(author.id("composed-root-exit"))
  );
  expect(exitEdge?.exitedLoopIds).toEqual([
    author.id("composed-inner"),
    author.id("composed-outer"),
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("composed-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("composed-overridden")).toBeVisible();
  await expect(runtime.trial("inner-skipped")).toHaveCount(0);
  await expect(runtime.trial("outer-skipped")).toHaveCount(0);
  const snapshot = await runtime.snapshot();
  expect(snapshot.events.map((event) => event.type)).toEqual(
    expect.arrayContaining(["branch-decision", "params-override"]),
  );
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("composed-source")),
    String(author.id("composed-root-exit")),
  ]);
  await runtime.assertNoRuntimeFailures();
});
