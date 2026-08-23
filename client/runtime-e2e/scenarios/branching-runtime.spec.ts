import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl as apiBaseUrl,
} from "../support/session";

test("authors a conditional branch, executes the selected route, and persists only executed trials", async ({
  page,
}) => {
  const author = new ScenarioAuthor(apiBaseUrl);
  await author.createExperiment(`runtime-branch-${Date.now()}`);
  await author.createTrial("source");
  await author.createTrial("skipped-sequential");
  await author.addRootBranch("source", "default-branch");
  await author.addRootBranch("source", "matched-branch");

  await author.configureButtonTrials([
    "source",
    "skipped-sequential",
    "default-branch",
    "matched-branch",
  ]);
  await author.configureBranchConditions("source", [
    {
      id: 1,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "matched-branch",
    },
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect(runtime.trial("source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("matched-branch")).toBeVisible();
  await expect(runtime.trial("skipped-sequential")).toHaveCount(0);
  await expect(runtime.trial("default-branch")).toHaveCount(0);
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const snapshot = await runtime.snapshot();
  const decisions = snapshot.events.filter(
    (event) => event.type === "branch-decision",
  );
  expect(decisions).toContainEqual(
    expect.objectContaining({
      payload: expect.objectContaining({
        targetId: author.id("matched-branch"),
        conditionId: 1,
        usedDefault: false,
      }),
    }),
  );

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(persisted.session.state).toBe("completed");
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("source")),
    String(author.id("matched-branch")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("authors a branch from a non-terminal loop trial and exits to root at runtime", async ({
  page,
}) => {
  const author = new ScenarioAuthor(apiBaseUrl);
  await author.createExperiment(`runtime-loop-exit-${Date.now()}`);
  await author.createTrial("loop-source");
  await author.createTrial("inside-loop-skipped");
  await author.createLoop("main-loop", [
    "loop-source",
    "inside-loop-skipped",
  ]);
  await author.addLoopExitBranch("loop-source", "root-exit");
  await author.configureButtonTrials([
    "loop-source",
    "inside-loop-skipped",
    "root-exit",
  ]);

  const graph = await author.assertHealthyGraph();
  const exitEdge = graph.edges.find(
    (edge) =>
      String(edge.sourceId) === String(author.id("loop-source")) &&
      String(edge.targetId) === String(author.id("root-exit")),
  );
  expect(exitEdge?.exitedLoopIds).toEqual([author.id("main-loop")]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect(runtime.trial("loop-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("root-exit")).toBeVisible();
  await expect(runtime.trial("inside-loop-skipped")).toHaveCount(0);
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("loop-source")),
    String(author.id("root-exit")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("turns a generated-runtime exception into a participant error screen and machine-readable failure", async ({
  page,
}) => {
  const author = new ScenarioAuthor(apiBaseUrl);
  await author.createExperiment(`runtime-error-${Date.now()}`);
  await author.createTrial("broken-trial");
  await author.configureButtonTrial("broken-trial", {
    customOnStart:
      "setTimeout(() => { throw new Error('intentional-runtime-failure'); }, 0);",
  });

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  const errorScreen = page.locator("#expbuilder-runtime-error");
  await expect(errorScreen).toBeVisible();
  await expect(errorScreen).toContainText("The experiment could not continue");
  await expect(errorScreen).toContainText("Error reference: RUNTIME-");
  const snapshot = await runtime.snapshot();
  expect(snapshot.errors).toContainEqual(
    expect.objectContaining({ message: "intentional-runtime-failure" }),
  );
});

test("loads the versioned DynamicPlugin asset and persists its real response", async ({
  page,
}) => {
  const author = new ScenarioAuthor(apiBaseUrl);
  await author.createExperiment(`runtime-dynamic-${Date.now()}`);
  await author.createTrial("dynamic-button");
  await author.configureDynamicButtonTrial("dynamic-button");

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (
            window as Window & { DynamicPlugin?: unknown }
          ).DynamicPlugin,
      ),
    )
    .toBe("function");
  await runtime.clickDynamicCanvasCenter();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("dynamic-button")),
  ]);
  expect(persisted.session.data[0]).toEqual(
    expect.objectContaining({ runtimeButton_response: "Continue" }),
  );
  await runtime.assertNoRuntimeFailures();
});
