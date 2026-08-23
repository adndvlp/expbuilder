import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("authors exits at two nested-loop levels and executes the selected root exit", async ({
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
