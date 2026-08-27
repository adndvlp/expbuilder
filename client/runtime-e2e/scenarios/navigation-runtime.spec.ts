import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("[RUNTIME-JUMP-ROOT] [TJ-01] authors a jump condition, restarts at the exact target, and completes once", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-jump-${Date.now()}`);
  await author.createTrial("jump-target");
  await author.createTrial("jump-trigger");
  await author.createTrial("after-jump");
  await author.configureButtonTrials([
    "jump-target",
    "jump-trigger",
    "after-jump",
  ]);
  await author.configureButtonTrial("jump-trigger", {}, ["Repeat", "Continue"]);
  await author.configureRepeatConditions("jump-trigger", [
    {
      id: 71,
      rules: [{ column: "response", op: "==", value: "0" }],
      jumpToTrialAlias: "jump-target",
    },
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect(runtime.trial("jump-target")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("jump-trigger")).toBeVisible();
  const originalSessionId = await runtime.sessionId();
  await runtime.choose("Repeat");
  await expect(runtime.trial("jump-target")).toBeVisible();
  const routedSessionId = await runtime.sessionId();
  expect(routedSessionId).not.toBe(originalSessionId);
  await expect.poll(async () => {
    const firstRun = await loadPersistedSession(
      author.experimentId,
      originalSessionId,
    );
    return builderIds(firstRun.session.data);
  }).toEqual([
    String(author.id("jump-target")),
    String(author.id("jump-trigger")),
  ]);
  await runtime.continue();
  await expect(runtime.trial("jump-trigger")).toBeVisible();
  await runtime.choose("Continue");
  await expect(runtime.trial("after-jump")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const snapshot = await runtime.snapshot();
  expect(snapshot.events).toContainEqual(
    expect.objectContaining({
      type: "jump-reload-resume",
      payload: expect.objectContaining({
        conditionId: 71,
        targetId: author.id("jump-target"),
        sourceSessionId: originalSessionId,
      }),
    }),
  );
  expect(snapshot.events).toContainEqual(
    expect.objectContaining({
      type: "jump-target-enter",
      payload: expect.objectContaining({ targetId: author.id("jump-target") }),
    }),
  );

  const persisted = await loadPersistedSession(
    author.experimentId,
    routedSessionId,
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("jump-target")),
    String(author.id("jump-trigger")),
    String(author.id("after-jump")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-RESUME-BRANCH] [TRES-02] [TRES-09] resumes the resolved route with its parameters and cleans navigation state", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-resume-${Date.now()}`);
  await author.createTrial("resume-source");
  await author.createTrial("resume-skipped-sequential");
  await author.addRootBranch("resume-source", "resume-target");
  await author.configureButtonTrials([
    "resume-source",
    "resume-skipped-sequential",
    "resume-target",
  ]);
  await author.configureBranchConditions("resume-source", [
    {
      id: 81,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "resume-target",
      customParameters: {
        stimulus: {
          source: "typed",
          value:
            '<main data-runtime-trial="resume-override">restored route</main>',
        },
      },
    },
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect(runtime.trial("resume-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("resume-override")).toBeVisible();
  const originalSessionId = await runtime.sessionId();
  await runtime.waitForPersistence();
  const checkpoint = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jsPsych_resumeTrial") ?? "null"),
  );
  expect(checkpoint).toEqual({
    version: 1,
    completed: {
      builderId: author.id("resume-source"),
      trialIndex: 0,
    },
    route: {
      kind: "branch",
      targetId: String(author.id("resume-target")),
      conditionId: 81,
      customParameters: {
        stimulus: {
          source: "typed",
          value:
            '<main data-runtime-trial="resume-override">restored route</main>',
        },
      },
      usedDefault: false,
    },
  });
  await expect.poll(async () => {
    const persisted = await loadPersistedSession(
      author.experimentId,
      originalSessionId,
    );
    return builderIds(persisted.session.data);
  }).toEqual([String(author.id("resume-source"))]);

  await page.reload();
  await expect(runtime.trial("resume-override")).toBeVisible();
  await expect(runtime.trial("resume-source")).toHaveCount(0);
  await expect(runtime.trial("resume-skipped-sequential")).toHaveCount(0);
  expect(await runtime.sessionId()).toBe(originalSessionId);
  const resumedSnapshot = await runtime.snapshot();
  expect(resumedSnapshot.events).toContainEqual(
    expect.objectContaining({
      type: "resume-route-activated",
      payload: expect.objectContaining({
        kind: "branch",
        sourceId: author.id("resume-source"),
        targetId: String(author.id("resume-target")),
        conditionId: 81,
      }),
    }),
  );
  expect(resumedSnapshot.events).toContainEqual(
    expect.objectContaining({
      type: "branch-target-enter",
      payload: expect.objectContaining({ targetId: author.id("resume-target") }),
    }),
  );

  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const persisted = await loadPersistedSession(
    author.experimentId,
    originalSessionId,
  );
  expect(persisted.session.state).toBe("completed");
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("resume-source")),
    String(author.id("resume-target")),
  ]);
  expect(
    await page.evaluate(() => ({
      checkpoint: localStorage.getItem("jsPsych_resumeTrial"),
      currentSession: localStorage.getItem("jsPsych_currentSessionId"),
      participant: localStorage.getItem("jsPsych_participantNumber"),
      jumpRequest: localStorage.getItem("jsPsych_jumpRequest"),
      legacyJumpTarget: localStorage.getItem("jsPsych_jumpToTrial"),
      jumpReload: sessionStorage.getItem("jsPsych_jumpReload"),
      legacyJumpContext: sessionStorage.getItem("jsPsych_jumpContext"),
    })),
  ).toEqual({
    checkpoint: null,
    currentSession: null,
    participant: null,
    jumpRequest: null,
    legacyJumpTarget: null,
    jumpReload: null,
    legacyJumpContext: null,
  });
  await runtime.assertNoRuntimeFailures();
});

test("[RUNTIME-RESUME-SEQUENTIAL] [TRES-01] resumes after a completed root trial at its compiled next address", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-resume-sequential-${Date.now()}`);
  await author.createTrial("resume-first");
  await author.createTrial("resume-second");
  await author.createTrial("resume-third");
  await author.configureButtonTrials([
    "resume-first",
    "resume-second",
    "resume-third",
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect(runtime.trial("resume-first")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("resume-second")).toBeVisible();
  const sessionId = await runtime.sessionId();
  await runtime.waitForPersistence();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("jsPsych_resumeTrial") ?? "null"),
    ),
  ).toEqual({
    version: 1,
    completed: {
      builderId: author.id("resume-first"),
      trialIndex: 0,
    },
    route: {
      kind: "sequential",
      targetId: String(author.id("resume-second")),
      conditionId: null,
      customParameters: null,
      usedDefault: false,
    },
  });

  await page.reload();
  await expect(runtime.trial("resume-second")).toBeVisible();
  await expect(runtime.trial("resume-first")).toHaveCount(0);
  expect(await runtime.sessionId()).toBe(sessionId);
  expect((await runtime.snapshot()).events).toContainEqual(
    expect.objectContaining({
      type: "resume-route-activated",
      payload: expect.objectContaining({
        kind: "sequential",
        sourceId: author.id("resume-first"),
        targetId: String(author.id("resume-second")),
      }),
    }),
  );

  await runtime.continue();
  await expect(runtime.trial("resume-third")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const persisted = await loadPersistedSession(author.experimentId, sessionId);
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("resume-first")),
    String(author.id("resume-second")),
    String(author.id("resume-third")),
  ]);
  await runtime.assertNoRuntimeFailures();
});
