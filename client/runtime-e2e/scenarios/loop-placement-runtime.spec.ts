import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("[RUNTIME-LOOP-PARALLEL-LEVEL] [TA-01] keeps two same-level exits parallel and executes only the selected route", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-loop-parallel-${Date.now()}`);
  await author.createTrial("parallel-source");
  await author.createTrial("parallel-loop-skipped");
  await author.createLoop("parallel-loop", [
    "parallel-source",
    "parallel-loop-skipped",
  ]);
  await author.addLoopExitBranch("parallel-source", "parallel-default");
  await author.addLoopExitBranch(
    "parallel-source",
    "parallel-selected",
    null,
    "parallel",
  );
  await author.configureButtonTrials([
    "parallel-source",
    "parallel-loop-skipped",
    "parallel-default",
    "parallel-selected",
  ]);
  await author.configureBranchConditions("parallel-source", [
    {
      id: 71,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "parallel-selected",
    },
  ]);

  const graph = await author.assertHealthyGraph();
  const sourceId = String(author.id("parallel-source"));
  const targets = graph.edges
    .filter((edge) => String(edge.sourceId) === sourceId)
    .map((edge) => String(edge.targetId));
  expect(targets).toEqual(expect.arrayContaining([
    String(author.id("parallel-default")),
    String(author.id("parallel-selected")),
  ]));

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("parallel-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("parallel-selected")).toBeVisible();
  await expect(runtime.trial("parallel-default")).toHaveCount(0);
  await expect(runtime.trial("parallel-loop-skipped")).toHaveCount(0);
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    sourceId,
    String(author.id("parallel-selected")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-LOOP-SEQUENTIAL-LEVEL] [TA-02] inserts the new exit before the existing same-level route", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-loop-sequential-${Date.now()}`);
  await author.createTrial("sequential-source");
  await author.createTrial("sequential-loop-skipped");
  await author.createLoop("sequential-loop", [
    "sequential-source",
    "sequential-loop-skipped",
  ]);
  await author.addLoopExitBranch("sequential-source", "existing-exit");
  await author.addLoopExitBranch(
    "sequential-source",
    "inserted-exit",
    null,
    "sequential",
  );
  await author.configureButtonTrials([
    "sequential-source",
    "sequential-loop-skipped",
    "inserted-exit",
    "existing-exit",
  ]);

  const graph = await author.assertHealthyGraph();
  expect(graph.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({
      sourceId: author.id("sequential-source"),
      targetId: author.id("inserted-exit"),
      exitedLoopIds: [author.id("sequential-loop")],
    }),
    expect.objectContaining({
      sourceId: author.id("inserted-exit"),
      targetId: author.id("existing-exit"),
      exitedLoopIds: [],
    }),
  ]));

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("sequential-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("inserted-exit")).toBeVisible();
  await expect(runtime.trial("sequential-loop-skipped")).toHaveCount(0);
  await runtime.continue();
  await expect(runtime.trial("existing-exit")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("sequential-source")),
    String(author.id("inserted-exit")),
    String(author.id("existing-exit")),
  ]);
  await runtime.assertNoRuntimeFailures();
});
