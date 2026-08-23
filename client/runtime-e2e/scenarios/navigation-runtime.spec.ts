import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("authors a jump condition, restarts at the exact target, and completes once", async ({
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
        targetId: String(author.id("jump-target")),
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

test("resumes the same persisted session at the branch selected by its last response", async ({
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

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);

  await expect(runtime.trial("resume-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("resume-target")).toBeVisible();
  const originalSessionId = await runtime.sessionId();
  await runtime.waitForPersistence();
  await expect.poll(async () => {
    const persisted = await loadPersistedSession(
      author.experimentId,
      originalSessionId,
    );
    return builderIds(persisted.session.data);
  }).toEqual([String(author.id("resume-source"))]);

  await page.reload();
  await expect(runtime.trial("resume-target")).toBeVisible();
  await expect(runtime.trial("resume-source")).toHaveCount(0);
  await expect(runtime.trial("resume-skipped-sequential")).toHaveCount(0);
  expect(await runtime.sessionId()).toBe(originalSessionId);
  const resumedSnapshot = await runtime.snapshot();
  expect(resumedSnapshot.events).toContainEqual(
    expect.objectContaining({
      type: "jump-target-enter",
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
  await runtime.assertNoRuntimeFailures();
});
