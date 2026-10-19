import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test("[RUNTIME-RESOLVED-MEGA] composes conditional loop, params, nested exit, resume, return, move, and root branching", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-resolved-mega-${Date.now()}`);

  await author.createTrial("mega-conditional-source");
  await author.createTrial("mega-conditional-target");
  await author.createLoop("mega-conditional-loop", [
    "mega-conditional-source",
    "mega-conditional-target",
  ]);
  await author.createTrial("mega-move-anchor");

  await author.createTrial("mega-exit-source");
  await author.createTrial("mega-inner-skipped");
  await author.createLoop("mega-inner-loop", [
    "mega-exit-source",
    "mega-inner-skipped",
  ]);
  await author.createTrial("mega-outer-skipped");
  await author.createLoop("mega-outer-loop", [
    "mega-inner-loop",
    "mega-outer-skipped",
  ]);

  await author.createTrial("mega-return-target");
  await author.addLoopExitBranch(
    "mega-exit-source",
    "mega-exit-target",
    null,
    "sequential",
  );
  await author.createTrial("mega-after-return");
  await author.createTrial("mega-root-branch-source");
  await author.createTrial("mega-moved-trial");
  await author.addRootBranch(
    "mega-root-branch-source",
    "mega-root-branch-target",
  );

  await author.configureButtonTrials([
    "mega-conditional-source",
    "mega-conditional-target",
    "mega-exit-source",
    "mega-inner-skipped",
    "mega-outer-skipped",
    "mega-root-branch-source",
    "mega-after-return",
    "mega-return-target",
    "mega-moved-trial",
    "mega-move-anchor",
    "mega-root-branch-target",
  ]);
  await author.configureButtonTrial(
    "mega-exit-target",
    { branches: [author.id("mega-after-return")], defaultNextTrialId: author.id("mega-after-return") },
    ["Return", "Continue"],
  );
  await author.configureButtonTrial("mega-return-target", {
    branches: [author.id("mega-exit-target")],
    defaultNextTrialId: author.id("mega-exit-target"),
  });
  await author.configureButtonTrial("mega-after-return", {
    branches: [author.id("mega-root-branch-source")],
    defaultNextTrialId: author.id("mega-root-branch-source"),
  });

  await author.configureParamsOverride("mega-conditional-target", [
    {
      id: 171,
      rules: [
        {
          trialAlias: "mega-conditional-source",
          column: "response",
          op: "==",
          value: "0",
        },
      ],
      paramsToOverride: {
        stimulus: {
          source: "typed",
          value: '<main data-runtime-trial="mega-params-applied">mega</main>',
        },
      },
    },
  ]);
  await author.configureConditionalLoop("mega-conditional-loop", [
    {
      id: 172,
      rules: [
        {
          trialAlias: "mega-conditional-target",
          column: "trial_index",
          op: "<",
          value: "2",
        },
      ],
    },
  ]);
  await author.configureBranchConditions("mega-exit-source", [
    {
      id: 173,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "mega-exit-target",
    },
  ]);
  await author.configureBranchConditions("mega-exit-target", [
    {
      id: 174,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "mega-return-target",
    },
  ]);
  await author.configureBranchConditions("mega-root-branch-source", [
    {
      id: 175,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "mega-root-branch-target",
    },
  ]);

  const graph = await author.moveAfter("mega-moved-trial", "mega-move-anchor");
  expect(
    graph.edges.some(
      (edge) =>
        String(edge.sourceId) ===
          String(author.id("mega-root-branch-source")) &&
        String(edge.targetId) === String(author.id("mega-root-branch-target")),
    ),
  ).toBe(true);

  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    await expect(runtime.trial("mega-conditional-source")).toBeVisible();
    await runtime.continue();
    await expect(runtime.trial("mega-params-applied")).toBeVisible();
    await runtime.continue();
  }
  await expect(runtime.trial("mega-move-anchor")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("mega-moved-trial")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("mega-exit-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("mega-exit-target")).toBeVisible();
  await expect(runtime.trial("mega-inner-skipped")).toHaveCount(0);
  await expect(runtime.trial("mega-outer-skipped")).toHaveCount(0);
  const beforeReturnSessionId = await runtime.sessionId();
  await runtime.waitForPersistence();
  const beforeResume = await runtime.snapshot();
  expect(
    beforeResume.events.filter((event) => event.type === "params-override"),
  ).toHaveLength(2);
  expect(
    beforeResume.events
      .filter((event) => event.type === "conditional-loop-decision")
      .map((event) => event.payload.shouldRepeat),
  ).toEqual([true, false]);

  await page.reload();
  await expect(runtime.trial("mega-exit-target")).toBeVisible();
  expect(await runtime.sessionId()).toBe(beforeReturnSessionId);
  expect((await runtime.snapshot()).events).toContainEqual(
    expect.objectContaining({ type: "resume-route-activated" }),
  );
  await runtime.choose("Return");

  await expect(runtime.trial("mega-return-target")).toBeVisible();
  const afterReturnSessionId = await runtime.sessionId();
  expect(afterReturnSessionId).toBe(beforeReturnSessionId);
  await runtime.continue();
  await expect(runtime.trial("mega-exit-target")).toBeVisible();
  await runtime.choose("Continue");
  await expect(runtime.trial("mega-after-return")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("mega-root-branch-source")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("mega-root-branch-target")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();

  const persisted = await loadPersistedSession(
    author.experimentId,
    beforeReturnSessionId,
  );
  expect(builderIds(persisted.session.data)).toEqual(
    [
      "mega-conditional-source",
      "mega-conditional-target",
      "mega-conditional-source",
      "mega-conditional-target",
      "mega-move-anchor",
      "mega-moved-trial",
      "mega-exit-source",
      "mega-exit-target",
      "mega-return-target",
      "mega-exit-target",
      "mega-after-return",
      "mega-root-branch-source",
      "mega-root-branch-target",
    ].map((alias) => String(author.id(alias))),
  );
  const finalSnapshot = await runtime.snapshot();
  expect(finalSnapshot.events.map((event) => event.type)).toEqual(
    expect.arrayContaining([
      "branch-decision",
      "branch-target-enter",
      "branch-decision",
    ]),
  );
  await runtime.assertNoRuntimeFailures();
});
