import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("[RUNTIME-BRANCH-CONDITIONAL-LOOP] branches inside a conditional loop on every repeated iteration", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-branch-conditional-${Date.now()}`);
  await author.createTrial("conditional-branch-source");
  await author.createTrial("conditional-sequential-skipped");
  await author.createLoop("branch-conditional-loop", [
    "conditional-branch-source",
    "conditional-sequential-skipped",
  ]);
  await author.addScopedBranch(
    "conditional-branch-source",
    "conditional-branch-target",
    "branch-conditional-loop",
  );
  await author.createTrial("after-branch-conditional");
  await author.configureButtonTrials([
    "conditional-branch-source",
    "conditional-sequential-skipped",
    "conditional-branch-target",
    "after-branch-conditional",
  ]);
  await author.configureBranchConditions("conditional-branch-source", [{
    id: 101,
    rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "conditional-branch-target",
  }]);
  await author.configureConditionalLoop("branch-conditional-loop", [{
    id: 102,
    rules: [{
      trialAlias: "conditional-branch-target",
      column: "trial_index",
      op: "<",
      value: "3",
    }],
  }]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    await expect(runtime.trial("conditional-branch-source")).toBeVisible();
    await runtime.continue();
    await expect(runtime.trial("conditional-branch-target")).toBeVisible();
    await expect(runtime.trial("conditional-sequential-skipped")).toHaveCount(0);
    await runtime.continue();
  }
  await expect(runtime.trial("after-branch-conditional")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const snapshot = await runtime.snapshot();
  expect(snapshot.events.filter((event) => event.type === "branch-decision"))
    .toHaveLength(2);
  expect(snapshot.events
    .filter((event) => event.type === "conditional-loop-decision")
    .map((event) => event.payload.shouldRepeat)).toEqual([true, false]);
  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    author.id("conditional-branch-source"),
    author.id("conditional-branch-target"),
    author.id("conditional-branch-source"),
    author.id("conditional-branch-target"),
    author.id("after-branch-conditional"),
  ].map(String));
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-LOOP-EXIT-CONDITIONAL-LOOP] executes an active loop exit when the configured loop condition is inactive", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-exit-conditional-${Date.now()}`);
  await author.createTrial("conditional-exit-source");
  await author.createTrial("conditional-exit-skipped");
  await author.createLoop("conditional-exit-loop", [
    "conditional-exit-source",
    "conditional-exit-skipped",
  ]);
  await author.addLoopExitBranch("conditional-exit-source", "conditional-exit-target");
  await author.configureButtonTrials([
    "conditional-exit-source",
    "conditional-exit-skipped",
    "conditional-exit-target",
  ]);
  await author.configureBranchConditions("conditional-exit-source", [{
    id: 111,
    rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "conditional-exit-target",
  }]);
  await author.configureConditionalLoop("conditional-exit-loop", [{
    id: 112,
    rules: [{
      trialAlias: "conditional-exit-source",
      column: "trial_index",
      op: "<",
      value: "0",
    }],
  }]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("conditional-exit-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("conditional-exit-target")).toBeVisible();
  await expect(runtime.trial("conditional-exit-skipped")).toHaveCount(0);
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    author.id("conditional-exit-source"),
    author.id("conditional-exit-target"),
  ].map(String));
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-PARAMS-CONDITIONAL-LOOP] reapplies authored params override throughout a conditional-loop repeat", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-params-conditional-${Date.now()}`);
  await author.createTrial("params-loop-source");
  await author.createTrial("params-loop-target");
  await author.createLoop("params-conditional-loop", [
    "params-loop-source",
    "params-loop-target",
  ]);
  await author.createTrial("after-params-conditional");
  await author.configureButtonTrials([
    "params-loop-source",
    "params-loop-target",
    "after-params-conditional",
  ]);
  await author.configureParamsOverride("params-loop-target", [{
    id: 121,
    rules: [{
      trialAlias: "params-loop-source",
      column: "response",
      op: "==",
      value: "0",
    }],
    paramsToOverride: {
      stimulus: {
        source: "typed",
        value: '<main data-runtime-trial="params-loop-overridden">override</main>',
      },
    },
  }]);
  await author.configureConditionalLoop("params-conditional-loop", [{
    id: 122,
    rules: [{
      trialAlias: "params-loop-target",
      column: "trial_index",
      op: "<",
      value: "2",
    }],
  }]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    await expect(runtime.trial("params-loop-source")).toBeVisible();
    await runtime.continue();
    await expect(runtime.trial("params-loop-overridden")).toBeVisible();
    await runtime.continue();
  }
  await expect(runtime.trial("after-params-conditional")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const snapshot = await runtime.snapshot();
  expect(snapshot.events.filter((event) => event.type === "params-override"))
    .toHaveLength(2);
  expect(snapshot.events
    .filter((event) => event.type === "conditional-loop-decision")
    .map((event) => event.payload.shouldRepeat)).toEqual([true, false]);
  const persisted = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(persisted.session.data)).toEqual([
    author.id("params-loop-source"),
    author.id("params-loop-target"),
    author.id("params-loop-source"),
    author.id("params-loop-target"),
    author.id("after-params-conditional"),
  ].map(String));
  await runtime.assertNoRuntimeFailures();
});
