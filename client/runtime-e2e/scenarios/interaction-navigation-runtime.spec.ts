import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { compileScenarioArtifact } from "../authoring/compileScenarioArtifact";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
  localRuntimeStorageKeys,
} from "../support/session";

test("[RUNTIME-BRANCH-CHAIN] chains an authored branch into a root return without replaying the branch source", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-branch-return-${Date.now()}`);
  await author.createTrial("branch-return-source");
  await author.createTrial("branch-return-skipped");
  await author.createTrial("branch-return-target");
  await author.addRootBranch("branch-return-source", "branch-return-trigger");
  await author.configureButtonTrials([
    "branch-return-source",
    "branch-return-skipped",
    "branch-return-target",
  ]);
  await author.configureButtonTrial(
    "branch-return-trigger",
    {},
    ["Return", "Continue"],
  );
  // The trigger is a branch destination; select it explicitly after the return.
  await author.configureButtonTrial("branch-return-target", {
    branches: [author.id("branch-return-trigger")],
    defaultNextTrialId: author.id("branch-return-trigger"),
  });
  await author.configureBranchConditions("branch-return-source", [{
    id: 131,
    rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "branch-return-trigger",
  }]);
  await author.configureBranchConditions("branch-return-trigger", [{
    id: 132,
    rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "branch-return-target",
  }]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("branch-return-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("branch-return-trigger")).toBeVisible();
  const branchSessionId = await runtime.sessionId();
  const documentId = await page.evaluate(() => {
    const token = crypto.randomUUID();
    Object.assign(window, { navigationDocumentId: token });
    return token;
  });
  await runtime.choose("Return");
  await expect(runtime.trial("branch-return-target")).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "navigationDocumentId")))
    .toBe(documentId);
  const returnSessionId = await runtime.sessionId();
  expect(returnSessionId).toBe(branchSessionId);
  await runtime.continue();
  await expect(runtime.trial("branch-return-trigger")).toBeVisible();
  await runtime.choose("Continue");
  await test.info().attach("navigation-events", {
    body: JSON.stringify(await runtime.snapshot(), null, 2),
    contentType: "application/json",
  });
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    branchSessionId,
  );
  expect(builderIds(persisted.session.data)).toEqual([
    author.id("branch-return-source"),
    author.id("branch-return-trigger"),
    author.id("branch-return-target"),
    author.id("branch-return-trigger"),
  ].map(String));
  await runtime.assertNoRuntimeFailures();
});

test("resumes a cross-scope branch during the source's inter-trial gap", async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-exit-gap-${Date.now()}`);
  await author.createTrial("gap-source");
  await author.createLoop("gap-loop", ["gap-source"]);
  await author.client.updateLoop(author.experimentId, author.id("gap-loop"), {
    csvJson: [{ row: 1 }, { row: 2 }], repetitions: 2,
  });
  await author.addLoopExitBranch("gap-source", "gap-target");
  await author.configureButtonTrials(["gap-source", "gap-target"]);
  await author.configureBranchConditions("gap-source", [{
    id: 160, rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "gap-target",
  }]);
  const artifact = await compileScenarioArtifact({
    apiBaseUrl: author.apiBaseUrl, client: author.client, experimentId: author.experimentId,
    localParams: { default_iti: "4000" },
  });
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("gap-source")).toBeVisible();
  const sessionId = await runtime.sessionId();
  await runtime.continue();
  const key = localRuntimeStorageKeys(author.experimentId).resumeTrial;
  await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "null")?.completed?.builderId, key)).toBe(author.id("gap-source"));
  await runtime.waitForPersistence();
  await page.reload();
  await expect(runtime.trial("gap-target")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  expect(builderIds((await loadPersistedSession(author.experimentId, sessionId)).session.data)).toEqual([
    String(author.id("gap-source")), String(author.id("gap-target")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-LOOP-EXIT-CHAIN] chains a loop exit into a root return in one persisted session", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-loop-exit-return-${Date.now()}`);
  await author.createTrial("exit-return-source");
  await author.createTrial("exit-return-inside-skipped");
  await author.createLoop("exit-return-loop", [
    "exit-return-source",
    "exit-return-inside-skipped",
  ]);
  await author.createTrial("exit-return-target");
  await author.addLoopExitBranch(
    "exit-return-source",
    "exit-return-trigger",
    null,
    "sequential",
  );
  await author.configureButtonTrials([
    "exit-return-source",
    "exit-return-inside-skipped",
    "exit-return-target",
  ]);
  await author.configureButtonTrial(
    "exit-return-trigger",
    {},
    ["Return", "Continue"],
  );
  await author.configureButtonTrial("exit-return-target", {
    branches: [author.id("exit-return-trigger")],
    defaultNextTrialId: author.id("exit-return-trigger"),
  });
  await author.configureBranchConditions("exit-return-source", [{
    id: 141,
    rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "exit-return-trigger",
  }]);
  await author.configureBranchConditions("exit-return-trigger", [{
    id: 142,
    rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "exit-return-target",
  }]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("exit-return-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("exit-return-trigger")).toBeVisible();
  await expect(runtime.trial("exit-return-inside-skipped")).toHaveCount(0);
  const exitSessionId = await runtime.sessionId();
  const documentId = await page.evaluate(() => {
    const token = crypto.randomUUID();
    Object.assign(window, { navigationDocumentId: token });
    return token;
  });
  await runtime.choose("Return");
  await expect(runtime.trial("exit-return-target")).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "navigationDocumentId")))
    .toBe(documentId);
  const returnSessionId = await runtime.sessionId();
  expect(returnSessionId).toBe(exitSessionId);
  await runtime.continue();
  await expect(runtime.trial("exit-return-trigger")).toBeVisible();
  await runtime.choose("Continue");
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    exitSessionId,
  );
  expect(builderIds(persisted.session.data)).toEqual([
    author.id("exit-return-source"),
    author.id("exit-return-trigger"),
    author.id("exit-return-target"),
    author.id("exit-return-trigger"),
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
