import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  localRuntimeStorageKeys,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

for (const corruption of ["revision format", "destination"]) {
  test(`[TJ-05] [TJ-08] [RUNTIME-BRANCH-INVALID] rejects an invalid saved ${corruption} without restarting the route`, async ({ page }) => {
    const author = new ScenarioAuthor(runtimeApiBaseUrl);
    await author.createExperiment("invalid-navigation-" + Date.now());
    await author.createTrial("First");
    await author.createTrial("Second");
    await author.configureButtonTrials(["First", "Second"]);
    const artifact = await author.compileAndBuild();
    const runtime = new RuntimeObserver(page);
    await page.goto(artifact.experimentUrl);
    await expect(runtime.trial("First")).toBeVisible();
    await runtime.continue();
    await expect(runtime.trial("Second")).toBeVisible();
    await runtime.waitForPersistence();
    const sessionId = await runtime.sessionId();
    const keys = localRuntimeStorageKeys(author.experimentId);
    const key = keys.resumeTrial;
    await page.evaluate(({ key, corruption }) => {
      const saved = JSON.parse(localStorage.getItem(key)!);
      // A different nonempty revision is valid when the saved route still exists.
      if (corruption === "revision format") saved.experimentRevision = "";
      else saved.cursor.targetId = "missing-destination";
      localStorage.setItem(key, JSON.stringify(saved));
    }, { key, corruption });
    const corruptedCheckpoint = await runtime.resumeCheckpoint(key);
    let reloads = 0;
    page.on("framenavigated", () => reloads++);
    await page.reload();
    await expect(page.getByText("The experiment could not continue")).toBeVisible();
    await expect(runtime.trial("First")).toHaveCount(0);
    await expect(runtime.trial("Second")).toHaveCount(0);
    expect(reloads).toBe(1);
    expect(await page.evaluate(key => localStorage.getItem(key), keys.sessionId)).toBe(sessionId);
    expect(await runtime.resumeCheckpoint(key)).toEqual(corruptedCheckpoint);
    const persisted = await loadPersistedSession(author.experimentId, sessionId);
    expect(builderIds(persisted.session.data)).toEqual([String(author.id("First"))]);
  });
}

test("[TJ-08] [RUNTIME-RESUME-REVISION] resumes the current trial after a name change without repeating saved responses", async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment("resume-new-revision-" + Date.now());
  await author.createTrial("First");
  await author.createTrial("Second");
  await author.configureButtonTrials(["First", "Second"]);
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  const keys = localRuntimeStorageKeys(author.experimentId);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("First")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("Second")).toBeVisible();
  await runtime.waitForPersistence();
  const sessionId = await runtime.sessionId();
  const participant = await page.evaluate(key => localStorage.getItem(key), keys.participant);
  const checkpoint = await runtime.resumeCheckpoint(keys.resumeTrial);
  expect(checkpoint.cursor.targetId).toBe(String(author.id("Second")));

  await author.client.updateTrial(author.experimentId, author.id("First"), { name: "Renamed First" });
  const updated = await author.compileAndBuild();
  expect(updated.experimentUrl).toBe(artifact.experimentUrl);
  await page.reload();

  await expect(runtime.trial("Second")).toBeVisible();
  await expect(runtime.trial("First")).toHaveCount(0);
  expect(await page.evaluate(() =>
    (window as unknown as { ExpBuilderExecutionAddresses: { revision: string } }).ExpBuilderExecutionAddresses.revision,
  )).not.toBe(checkpoint.experimentRevision);
  expect(await runtime.sessionId()).toBe(sessionId);
  expect(await page.evaluate(key => localStorage.getItem(key), keys.participant)).toBe(participant);
  const resumed = await loadPersistedSession(author.experimentId, sessionId);
  expect(builderIds(resumed.session.data)).toEqual([String(author.id("First"))]);

  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const completed = await loadPersistedSession(author.experimentId, sessionId);
  expect(completed.session.state).toBe("completed");
  expect(builderIds(completed.session.data)).toEqual([
    String(author.id("First")), String(author.id("Second")),
  ]);
  await runtime.assertNoRuntimeFailures();
});
