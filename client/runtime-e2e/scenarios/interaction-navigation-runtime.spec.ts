import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("[RUNTIME-BRANCH-JUMP] chains an authored branch into a root jump without replaying the branch source", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-branch-jump-${Date.now()}`);
  await author.createTrial("branch-jump-source");
  await author.createTrial("branch-jump-skipped");
  await author.createTrial("branch-jump-target");
  await author.addRootBranch("branch-jump-source", "branch-jump-trigger");
  await author.configureButtonTrials([
    "branch-jump-source",
    "branch-jump-skipped",
    "branch-jump-target",
  ]);
  await author.configureButtonTrial(
    "branch-jump-trigger",
    {},
    ["Jump", "Continue"],
  );
  await author.configureBranchConditions("branch-jump-source", [{
    id: 131,
    rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "branch-jump-trigger",
  }]);
  await author.configureRepeatConditions("branch-jump-trigger", [{
    id: 132,
    rules: [{ column: "response", op: "==", value: "0" }],
    jumpToTrialAlias: "branch-jump-target",
  }]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("branch-jump-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("branch-jump-trigger")).toBeVisible();
  const branchSessionId = await runtime.sessionId();
  await runtime.choose("Jump");
  await expect(runtime.trial("branch-jump-target")).toBeVisible();
  const jumpSessionId = await runtime.sessionId();
  expect(jumpSessionId).not.toBe(branchSessionId);
  await runtime.continue();
  await expect(runtime.trial("branch-jump-trigger")).toBeVisible();
  await runtime.choose("Continue");
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const beforeJump = await loadPersistedSession(
    author.experimentId,
    branchSessionId,
  );
  expect(builderIds(beforeJump.session.data)).toEqual([
    author.id("branch-jump-source"),
    author.id("branch-jump-trigger"),
  ].map(String));
  const afterJump = await loadPersistedSession(author.experimentId, jumpSessionId);
  expect(builderIds(afterJump.session.data)).toEqual([
    author.id("branch-jump-target"),
    author.id("branch-jump-trigger"),
  ].map(String));
  expect(builderIds(afterJump.session.data)).not.toContain(
    String(author.id("branch-jump-source")),
  );
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-LOOP-EXIT-JUMP] chains a loop exit into a root jump and persists each execution segment once", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-loop-exit-jump-${Date.now()}`);
  await author.createTrial("exit-jump-source");
  await author.createTrial("exit-jump-inside-skipped");
  await author.createLoop("exit-jump-loop", [
    "exit-jump-source",
    "exit-jump-inside-skipped",
  ]);
  await author.createTrial("exit-jump-target");
  await author.addLoopExitBranch(
    "exit-jump-source",
    "exit-jump-trigger",
    null,
    "sequential",
  );
  await author.configureButtonTrials([
    "exit-jump-source",
    "exit-jump-inside-skipped",
    "exit-jump-target",
  ]);
  await author.configureButtonTrial(
    "exit-jump-trigger",
    {},
    ["Jump", "Continue"],
  );
  await author.configureBranchConditions("exit-jump-source", [{
    id: 141,
    rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "exit-jump-trigger",
  }]);
  await author.configureRepeatConditions("exit-jump-trigger", [{
    id: 142,
    rules: [{ column: "response", op: "==", value: "0" }],
    jumpToTrialAlias: "exit-jump-target",
  }]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("exit-jump-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("exit-jump-trigger")).toBeVisible();
  await expect(runtime.trial("exit-jump-inside-skipped")).toHaveCount(0);
  const exitSessionId = await runtime.sessionId();
  await runtime.choose("Jump");
  await expect(runtime.trial("exit-jump-target")).toBeVisible();
  const jumpSessionId = await runtime.sessionId();
  expect(jumpSessionId).not.toBe(exitSessionId);
  await runtime.continue();
  await expect(runtime.trial("exit-jump-trigger")).toBeVisible();
  await runtime.choose("Continue");
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const beforeJump = await loadPersistedSession(
    author.experimentId,
    exitSessionId,
  );
  expect(builderIds(beforeJump.session.data)).toEqual([
    author.id("exit-jump-source"),
    author.id("exit-jump-trigger"),
  ].map(String));
  const afterJump = await loadPersistedSession(author.experimentId, jumpSessionId);
  expect(builderIds(afterJump.session.data)).toEqual([
    author.id("exit-jump-target"),
    author.id("exit-jump-trigger"),
  ].map(String));
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-NESTED-EXIT-RESUME] reloads a resolved nested-loop exit at its root target without replaying crossed scopes", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-nested-exit-resume-${Date.now()}`);
  await author.createTrial("nested-resume-source");
  await author.createTrial("nested-resume-inner-skipped");
  await author.createLoop("nested-resume-inner", [
    "nested-resume-source",
    "nested-resume-inner-skipped",
  ]);
  await author.createTrial("nested-resume-outer-skipped");
  await author.createLoop("nested-resume-outer", [
    "nested-resume-inner",
    "nested-resume-outer-skipped",
  ]);
  await author.addLoopExitBranch("nested-resume-source", "nested-resume-target");
  await author.configureButtonTrials([
    "nested-resume-source",
    "nested-resume-inner-skipped",
    "nested-resume-outer-skipped",
    "nested-resume-target",
  ]);
  await author.configureBranchConditions("nested-resume-source", [{
    id: 151,
    rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "nested-resume-target",
  }]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("nested-resume-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("nested-resume-target")).toBeVisible();
  const sessionId = await runtime.sessionId();
  await runtime.waitForPersistence();

  await page.reload();
  await expect(runtime.trial("nested-resume-target")).toBeVisible();
  await expect(runtime.trial("nested-resume-source")).toHaveCount(0);
  await expect(runtime.trial("nested-resume-inner-skipped")).toHaveCount(0);
  await expect(runtime.trial("nested-resume-outer-skipped")).toHaveCount(0);
  expect(await runtime.sessionId()).toBe(sessionId);
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(author.experimentId, sessionId);
  expect(builderIds(persisted.session.data)).toEqual([
    author.id("nested-resume-source"),
    author.id("nested-resume-target"),
  ].map(String));
  await runtime.assertNoRuntimeFailures();
});
