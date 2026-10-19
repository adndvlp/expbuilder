import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  localRuntimeStorageKeys,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("[RUNTIME-BRANCH-RETURN] [TJ-01] authors a return condition, continues at the exact target, and completes once", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-return-${Date.now()}`);
  await author.createTrial("return-target");
  await author.createTrial("return-trigger");
  await author.createTrial("after-return");
  await author.configureButtonTrials([
    "return-target",
    "return-trigger",
    "after-return",
  ]);
  await author.configureButtonTrial("return-trigger", {}, ["Repeat", "Continue"]);
  await author.configureBranchConditions("return-trigger", [
    {
      id: 71,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "return-target",
    },
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("return-target")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("return-trigger")).toBeVisible();
  const originalSessionId = await runtime.sessionId();
  const originalDocument = await page.evaluate(() => performance.timeOrigin);
  await runtime.choose("Repeat");
  await expect(runtime.trial("return-target")).toBeVisible();
  const continuedSessionId = await runtime.sessionId();
  expect(continuedSessionId).toBe(originalSessionId);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(
    originalDocument,
  );
  await expect
    .poll(async () => {
      const firstRun = await loadPersistedSession(
        author.experimentId,
        originalSessionId,
      );
      return builderIds(firstRun.session.data);
    })
    .toEqual([
      String(author.id("return-target")),
      String(author.id("return-trigger")),
    ]);
  await runtime.continue();
  await expect(runtime.trial("return-trigger")).toBeVisible();
  await runtime.choose("Continue");
  await expect(runtime.trial("after-return")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const snapshot = await runtime.snapshot();
  expect(snapshot.events).toContainEqual(
    expect.objectContaining({
      type: "branch-persisted",
      payload: expect.objectContaining({
        targetId: author.id("return-target"),
      }),
    }),
  );
  expect(snapshot.events).toContainEqual(
    expect.objectContaining({
      type: "branch-target-enter",
      payload: expect.objectContaining({ targetId: author.id("return-target") }),
    }),
  );

  const persisted = await loadPersistedSession(
    author.experimentId,
    continuedSessionId,
  );
  expect(builderIds(persisted.session.data)).toEqual([
    String(author.id("return-target")),
    String(author.id("return-trigger")),
    String(author.id("return-target")),
    String(author.id("return-trigger")),
    String(author.id("after-return")),
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
  const customParameters = {
    stimulus: {
      source: "typed" as const,
      value: '<main data-runtime-trial="resume-override">restored route</main>',
    },
  };
  await author.configureBranchConditions("resume-source", [
    {
      id: 81,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "resume-target",
      customParameters,
    },
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  const storageKeys = localRuntimeStorageKeys(author.experimentId);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("resume-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("resume-override")).toBeVisible();
  const originalSessionId = await runtime.sessionId();
  await runtime.waitForPersistence();
  const checkpoint = await runtime.resumeCheckpoint(storageKeys.resumeTrial);
  expect(checkpoint).toMatchObject({
    version: 3,
    experimentRevision: expect.any(String),
    completed: {
      builderId: author.id("resume-source"),
      trialIndex: 0,
    },
    cursor: {
      targetId: String(author.id("resume-target")),
      afterCompleted: false,
      loops: [],
      globalRouting: {
        nativeTimeline: {
          index: 1,
          entries: [
            { id: String(author.id("resume-source")),  },
            {
              id: String(author.id("resume-target")),
              parameters: customParameters,
            },
          ],
        },
      },
    },
  });
  await expect
    .poll(async () => {
      const persisted = await loadPersistedSession(
        author.experimentId,
        originalSessionId,
      );
      return builderIds(persisted.session.data);
    })
    .toEqual([String(author.id("resume-source"))]);

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
        kind: "cursor",
        sourceId: author.id("resume-source"),
        targetId: String(author.id("resume-target")),
      }),
    }),
  );
  expect(resumedSnapshot.events).toContainEqual(
    expect.objectContaining({
      type: "resume-target-enter",
      payload: expect.objectContaining({
        targetId: author.id("resume-target"),
      }),
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
    await page.evaluate(
      (keys) => ({
        checkpoint: localStorage.getItem(keys.resumeTrial),
        currentSession: localStorage.getItem(keys.sessionId),
        participant: localStorage.getItem(keys.participant),
      }),
      storageKeys,
    ),
  ).toEqual({
    checkpoint: null,
    currentSession: null,
    participant: null,
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
  const storageKeys = localRuntimeStorageKeys(author.experimentId);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("resume-first")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("resume-second")).toBeVisible();
  const sessionId = await runtime.sessionId();
  await runtime.waitForPersistence();
  expect(await runtime.resumeCheckpoint(storageKeys.resumeTrial)).toMatchObject(
    {
      version: 3,
      experimentRevision: expect.any(String),
      completed: {
        builderId: author.id("resume-first"),
        trialIndex: 0,
      },
      cursor: {
        targetId: String(author.id("resume-second")),
        afterCompleted: false,
        loops: [],
        globalRouting: { nativeTimeline: { index: 1 } },
      },
    },
  );

  await page.reload();
  await expect(runtime.trial("resume-second")).toBeVisible();
  await expect(runtime.trial("resume-first")).toHaveCount(0);
  expect(await runtime.sessionId()).toBe(sessionId);
  expect((await runtime.snapshot()).events).toContainEqual(
    expect.objectContaining({
      type: "resume-route-activated",
      payload: expect.objectContaining({
        kind: "cursor",
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
