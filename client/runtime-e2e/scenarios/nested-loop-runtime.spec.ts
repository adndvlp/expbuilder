import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("[RUNTIME-NESTED-PARENT-EXIT] [TR-02] exits only the inner loop and executes its parent-scope target once", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-parent-scope-exit-${Date.now()}`);
  await author.createTrial("parent-exit-source");
  await author.createTrial("parent-exit-inner-skipped");
  await author.createLoop("parent-exit-inner", [
    "parent-exit-source",
    "parent-exit-inner-skipped",
  ]);
  await author.createLoop("parent-exit-outer", ["parent-exit-inner"]);
  await author.addLoopExitBranch(
    "parent-exit-source",
    "parent-scope-target",
    "parent-exit-outer",
  );
  await author.configureButtonTrials([
    "parent-exit-source",
    "parent-exit-inner-skipped",
    "parent-scope-target",
  ]);

  const graph = await author.assertHealthyGraph();
  const edge = graph.edges.find(
    (candidate) =>
      String(candidate.sourceId) === String(author.id("parent-exit-source")) &&
      String(candidate.targetId) === String(author.id("parent-scope-target")),
  );
  expect(edge).toMatchObject({
    targetOwnerId: author.id("parent-exit-outer"),
    exitedLoopIds: [author.id("parent-exit-inner")],
  });

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("parent-exit-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("parent-scope-target")).toBeVisible();
  await expect(runtime.trial("parent-exit-inner-skipped")).toHaveCount(0);
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("parent-exit-source")),
    String(author.id("parent-scope-target")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-NESTED-ANCESTOR-EXIT] [TR-03] exits two nested loops and executes its ancestor-scope target once", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-ancestor-scope-exit-${Date.now()}`);
  await author.createTrial("ancestor-exit-source");
  await author.createTrial("ancestor-exit-inner-skipped");
  await author.createLoop("ancestor-exit-inner", [
    "ancestor-exit-source",
    "ancestor-exit-inner-skipped",
  ]);
  await author.createLoop("ancestor-exit-middle", ["ancestor-exit-inner"]);
  await author.createLoop("ancestor-exit-outer", ["ancestor-exit-middle"]);
  await author.addLoopExitBranch(
    "ancestor-exit-source",
    "ancestor-scope-target",
    "ancestor-exit-outer",
  );
  await author.configureButtonTrials([
    "ancestor-exit-source",
    "ancestor-exit-inner-skipped",
    "ancestor-scope-target",
  ]);

  const graph = await author.assertHealthyGraph();
  const edge = graph.edges.find(
    (candidate) =>
      String(candidate.sourceId) ===
        String(author.id("ancestor-exit-source")) &&
      String(candidate.targetId) ===
        String(author.id("ancestor-scope-target")),
  );
  expect(edge).toMatchObject({
    targetOwnerId: author.id("ancestor-exit-outer"),
    exitedLoopIds: [
      author.id("ancestor-exit-inner"),
      author.id("ancestor-exit-middle"),
    ],
  });

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("ancestor-exit-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("ancestor-scope-target")).toBeVisible();
  await expect(runtime.trial("ancestor-exit-inner-skipped")).toHaveCount(0);
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("ancestor-exit-source")),
    String(author.id("ancestor-scope-target")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-NESTED-ROOT-EXIT] [TR-04] authors exits at two nested-loop levels and executes the selected root exit", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-nested-loop-exits-${Date.now()}`);
  await author.createTrial("nested-source");
  await author.createTrial("inner-sequential-skipped");
  await author.createLoop("inner-loop", [
    "nested-source",
    "inner-sequential-skipped",
  ]);
  await author.createTrial("outer-sequential-skipped");
  await author.createLoop("outer-loop", [
    "inner-loop",
    "outer-sequential-skipped",
  ]);
  await author.addLoopExitBranch(
    "nested-source",
    "outer-scope-exit",
    "outer-loop",
  );
  await author.addLoopExitBranch("nested-source", "root-scope-exit");
  await author.configureButtonTrials([
    "nested-source",
    "inner-sequential-skipped",
    "outer-sequential-skipped",
    "outer-scope-exit",
    "root-scope-exit",
  ]);
  await author.configureBranchConditions("nested-source", [
    {
      id: 61,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "root-scope-exit",
    },
  ]);

  const graph = await author.assertHealthyGraph();
  const sourceId = String(author.id("nested-source"));
  const edgeTo = (alias: string) =>
    graph.edges.find(
      (edge) =>
        String(edge.sourceId) === sourceId &&
        String(edge.targetId) === String(author.id(alias)),
    );
  expect(edgeTo("outer-scope-exit")?.exitedLoopIds).toEqual([
    author.id("inner-loop"),
  ]);
  expect(edgeTo("root-scope-exit")?.exitedLoopIds).toEqual([
    author.id("inner-loop"),
    author.id("outer-loop"),
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect(runtime.trial("nested-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("root-scope-exit")).toBeVisible();
  await expect(runtime.trial("inner-sequential-skipped")).toHaveCount(0);
  await expect(runtime.trial("outer-sequential-skipped")).toHaveCount(0);
  await expect(runtime.trial("outer-scope-exit")).toHaveCount(0);
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("nested-source")),
    String(author.id("root-scope-exit")),
  ]);
  await runtime.assertNoRuntimeFailures();
});
