import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  localRuntimeStorageKeys,
  runtimeApiBaseUrl,
} from "../support/session";

test("[RUNTIME-JUMP-INVALID] [TJ-05] [TJ-08] invalid addresses and stalled progress terminate without reload loops", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-invalid-jump-${Date.now()}`);
  await author.createTrial("invalid-jump-first");
  await author.createTrial("invalid-jump-second");
  await author.configureButtonTrials([
    "invalid-jump-first",
    "invalid-jump-second",
  ]);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  const storageKeys = localRuntimeStorageKeys(author.experimentId);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("invalid-jump-first")).toBeVisible();

  await page.evaluate((keys) => {
    const manifest = (
      window as Window & {
        ExpBuilderExecutionAddresses: { revision: string };
      }
    ).ExpBuilderExecutionAddresses;
    localStorage.setItem(
      keys.jumpRequest,
      JSON.stringify({
        version: 2,
        experimentRevision: manifest.revision,
        address: {
          targetId: "missing-builder-id",
          targetKind: "trial",
          targetOwnerId: null,
          enterLoopIds: [],
        },
        sourceId: "invalid-source",
        sourceTrialIndex: null,
        cursor: { nextEnterIndex: 0, progress: 0 },
        reloadGuard: { observedProgress: null },
        context: { navigationKind: "jump" },
      }),
    );
    sessionStorage.setItem(keys.jumpReload, "1");
  }, storageKeys);
  await page.reload();

  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  await expect(runtime.trial("invalid-jump-first")).toHaveCount(0);
  await expect(runtime.trial("invalid-jump-second")).toHaveCount(0);
  expect(
    await page.evaluate((keys) => ({
      jumpRequest: localStorage.getItem(keys.jumpRequest),
      jumpTarget: localStorage.getItem(keys.jumpTarget),
      jumpReload: sessionStorage.getItem(keys.jumpReload),
      jumpContext: sessionStorage.getItem(keys.jumpContext),
    }), storageKeys),
  ).toEqual({
    jumpRequest: null,
    jumpTarget: null,
    jumpReload: null,
    jumpContext: null,
  });
  expect((await runtime.snapshot()).events).toContainEqual(
    expect.objectContaining({
      type: "jump-invalidated",
      payload: expect.objectContaining({ reason: "JUMP_ADDRESS_NOT_FOUND" }),
    }),
  );
  await runtime.assertNoRuntimeFailures();

  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("invalid-jump-first")).toBeVisible();
  await page.evaluate(({ keys, targetId }) => {
    const manifest = (
      window as Window & {
        ExpBuilderExecutionAddresses: {
          revision: string;
          addressesByTarget: Record<string, unknown>;
        };
      }
    ).ExpBuilderExecutionAddresses;
    localStorage.setItem(
      keys.jumpRequest,
      JSON.stringify({
        version: 2,
        experimentRevision: manifest.revision,
        address: manifest.addressesByTarget[String(targetId)],
        sourceId: "stalled-source",
        sourceTrialIndex: null,
        cursor: { nextEnterIndex: 0, progress: 0 },
        reloadGuard: { observedProgress: 0 },
        context: { navigationKind: "jump" },
      }),
    );
    sessionStorage.setItem(keys.jumpReload, "1");
  }, { keys: storageKeys, targetId: author.id("invalid-jump-first") });
  await page.reload();

  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  expect((await runtime.snapshot()).events).toContainEqual(
    expect.objectContaining({
      type: "jump-invalidated",
      payload: expect.objectContaining({ reason: "JUMP_STALLED" }),
    }),
  );
  await runtime.assertNoRuntimeFailures();
});
