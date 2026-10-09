import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { compileScenarioArtifact } from "../authoring/compileScenarioArtifact";
import { compileAgentScenarioArtifact } from "../authoring/compileAgentScenarioArtifact";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { builderIds, localRuntimeStorageKeys, loadPersistedSession, runtimeApiBaseUrl } from "../support/session";

for (const generator of ["client", "agent"] as const) {
test(`${generator} resumes the current CSV row without taking the loop's deferred exit`, async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-loop-resume-${Date.now()}`);
  for (const alias of ["entry", "csv", "final"]) await author.createTrial(alias);
  await author.createLoop("csv-loop", ["csv"]);
  await author.client.updateLoop(author.experimentId, author.id("csv-loop"), {
    csvJson: [1, 2, 3].map(row => ({
      stimulus: `<main data-runtime-trial="csv">row${row}</main>`,
    })),
    repetitions: 2,
  });
  await author.configureButtonTrials(["entry", "final"]);
  await author.configureButtonTrial("entry", { branches: [author.id("csv")] });
  await author.configureButtonTrial("csv", {
    csvFromLoop: true, branches: [author.id("final")],
    columnMapping: {
      stimulus: { source: "csv", value: "stimulus" },
      choices: { source: "typed", value: ["Continue"] },
    },
  });
  const artifact = generator === "client"
    ? await author.compileAndBuild()
    : await compileAgentScenarioArtifact(author, true);
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await runtime.continue();
  await expect(runtime.trial("csv")).toHaveText("row1");
  await runtime.continue();
  await expect(runtime.trial("csv")).toHaveText("row2");
  const sessionId = await runtime.sessionId();
  await runtime.waitForPersistence();
  await page.reload();
  await expect(runtime.trial("csv")).toHaveText("row2");
  expect(await runtime.sessionId()).toBe(sessionId);
  for (const row of [2, 3, 1, 2, 3]) {
    await expect(runtime.trial("csv")).toHaveText(`row${row}`);
    await runtime.continue();
  }
  await expect(runtime.trial("final")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  expect(builderIds((await loadPersistedSession(author.experimentId, sessionId)).session.data)).toEqual([
    String(author.id("entry")),
    ...Array.from({ length: 6 }, () => String(author.id("csv"))),
    String(author.id("final")),
  ]);
  await runtime.assertNoRuntimeFailures();
});
}

test("restores three loop levels, including an unfinished repetition and the root continuation", async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-nested-resume-${Date.now()}`);
  for (const alias of ["entry", "OuterMarker", "MiddleMarker", "csv", "final"]) await author.createTrial(alias);
  await author.createLoop("inner", ["csv"]);
  await author.createLoop("middle", ["MiddleMarker", "inner"]);
  await author.createLoop("outer", ["OuterMarker", "middle"]);
  for (const [alias, column] of [["inner", "innerRow"], ["middle", "middleRow"], ["outer", "outerRow"]]) {
    await author.client.updateLoop(author.experimentId, author.id(alias), {
      csvJson: [1, 2].map(row => ({ [column]: row })),
      repetitions: alias === "inner" ? 2 : 1,
    });
  }
  await author.configureButtonTrials(["entry", "final"]);
  await author.configureButtonTrial("entry", { branches: [author.id("OuterMarker")] });
  for (const [alias, column] of [["OuterMarker", "outerRow"], ["MiddleMarker", "middleRow"]]) {
    await author.configureButtonTrial(alias, {
      csvFromLoop: true,
      columnMapping: {
        stimulus: { source: "csv", value: column },
        choices: { source: "typed", value: ["Continue"] },
      },
      customOnStart: `trial.stimulus = '<main data-runtime-trial="${alias}">' + trial.stimulus + '</main>';`,
    });
  }
  await author.configureButtonTrial("csv", {
    csvFromLoop: true, branches: [author.id("final")],
    columnMapping: {
      stimulus: { source: "csv", value: "innerRow" },
      choices: { source: "typed", value: ["Continue"] },
    },
    customOnStart: `const tuple = ['stimulus_OuterMarker', 'stimulus_MiddleMarker', 'stimulus_csv'].map(key => jsPsych.evaluateTimelineVariable(key)).join('/');
      trial.data.tuple = tuple;
      trial.stimulus = '<main data-runtime-trial="csv">' + tuple + '</main>';`,
    customOnFinish: `data.tuple = ['stimulus_OuterMarker', 'stimulus_MiddleMarker', 'stimulus_csv'].map(key => jsPsych.evaluateTimelineVariable(key)).join('/');`,
  });
  const tuples = [1, 2].flatMap(outer => [1, 2].flatMap(middle =>
    [1, 2, 1, 2].map(inner => `${outer}/${middle}/${inner}`),
  ));
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await runtime.continue();
  const sessionId = await runtime.sessionId();
  for (const [index, tuple] of tuples.entries()) {
    if (index % 8 === 0) {
      await expect(runtime.trial("OuterMarker")).toBeVisible();
      await runtime.continue();
    }
    if (index % 4 === 0) {
      await expect(runtime.trial("MiddleMarker")).toBeVisible();
      await runtime.continue();
    }
    await expect(runtime.trial("csv")).toHaveText(tuple);
    if ([0, 3, 6, 11, 15].includes(index)) {
      await runtime.waitForPersistence();
      await page.reload();
      await expect(runtime.trial("csv")).toHaveText(tuple);
      expect(await runtime.sessionId()).toBe(sessionId);
    }
    await runtime.continue();
  }
  await expect(runtime.trial("final")).toBeVisible();
  await runtime.waitForPersistence();
  await page.reload();
  await expect(runtime.trial("final")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const persisted = await loadPersistedSession(author.experimentId, sessionId);
  expect(persisted.session.data.filter(row => row.tuple).map(row => row.tuple)).toEqual(tuples);
  expect(builderIds(persisted.session.data)).toHaveLength(tuples.length + 8);
  await runtime.assertNoRuntimeFailures();
});

test("keeps the sampled random order and remaining repetitions on reload", async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-random-resume-${Date.now()}`);
  for (const alias of ["csv", "final"]) await author.createTrial(alias);
  await author.createLoop("random-loop", ["csv"]);
  await author.client.updateLoop(author.experimentId, author.id("random-loop"), {
    csvJson: [0, 1, 2, 3].map(row => ({ stimulus: `<main data-runtime-trial="csv">row${row}</main>` })),
    repetitions: 3, randomize: true,
  });
  await author.configureButtonTrial("final");
  await author.configureButtonTrial("csv", {
    csvFromLoop: true, branches: [author.id("final")],
    columnMapping: {
      stimulus: { source: "csv", value: "stimulus" },
      choices: { source: "typed", value: ["Continue"] },
    },
  });
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  const sessionId = await runtime.sessionId();
  const seen: string[] = [];
  const keys = localRuntimeStorageKeys(author.experimentId);
  let pendingOrder: number[] = [];
  for (let index = 0; index < 12; index++) {
    await expect(runtime.trial("csv")).toBeVisible();
    const text = await runtime.trial("csv").innerText();
    if (index === 5) {
      const checkpoint = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), keys.resumeTrial);
      expect(checkpoint.cursor.loops[0].repetition).toBe(1);
      pendingOrder = checkpoint.cursor.loops[0].order.slice(1);
      await runtime.waitForPersistence();
      await page.reload();
      await expect(runtime.trial("csv")).toHaveText(text);
    }
    if (index >= 5 && index < 8) expect(text).toBe(`row${pendingOrder[index - 5]}`);
    seen.push(text);
    await runtime.continue();
  }
  for (let repetition = 0; repetition < 3; repetition++) {
    expect(seen.slice(repetition * 4, (repetition + 1) * 4).sort()).toEqual(["row0", "row1", "row2", "row3"]);
  }
  await expect(runtime.trial("final")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  expect(builderIds((await loadPersistedSession(author.experimentId, sessionId)).session.data)).toHaveLength(13);
  await runtime.assertNoRuntimeFailures();
});

test("resumes after a saved response during the inter-trial gap without repeating it", async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-gap-resume-${Date.now()}`);
  for (const alias of ["csv", "final"]) await author.createTrial(alias);
  await author.createLoop("gap-loop", ["csv"]);
  await author.client.updateLoop(author.experimentId, author.id("gap-loop"), {
    csvJson: [1, 2].map(row => ({ stimulus: `<main data-runtime-trial="csv">row${row}</main>` })),
  });
  await author.configureButtonTrial("final");
  await author.configureButtonTrial("csv", {
    csvFromLoop: true, branches: [author.id("final")],
    columnMapping: {
      stimulus: { source: "csv", value: "stimulus" },
      choices: { source: "typed", value: ["Continue"] },
    },
  });
  const artifact = await compileScenarioArtifact({
    apiBaseUrl: author.apiBaseUrl, client: author.client,
    experimentId: author.experimentId, localParams: { default_iti: "4000" },
  });
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("csv")).toHaveText("row1");
  const sessionId = await runtime.sessionId();
  await runtime.continue();
  const key = localRuntimeStorageKeys(author.experimentId).resumeTrial;
  await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "null")?.cursor?.afterCompleted, key)).toBe(true);
  await runtime.waitForPersistence();
  await page.reload();
  await expect(runtime.trial("csv")).toHaveText("row2");
  await runtime.continue();
  await expect(runtime.trial("final")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  expect(builderIds((await loadPersistedSession(author.experimentId, sessionId)).session.data)).toEqual([
    String(author.id("csv")), String(author.id("csv")), String(author.id("final")),
  ]);
  await runtime.assertNoRuntimeFailures();
});

test("restores a selected branch and its parameters inside the current loop row", async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-branch-loop-resume-${Date.now()}`);
  for (const alias of ["source", "skipped", "target", "final"]) await author.createTrial(alias);
  await author.createLoop("branch-loop", ["source", "skipped", "target"]);
  await author.client.updateLoop(author.experimentId, author.id("branch-loop"), {
    csvJson: [{ row: 1 }, { row: 2 }],
  });
  await author.configureButtonTrials(["source", "skipped", "target", "final"]);
  await author.configureButtonTrial("source", { branches: [author.id("target")] });
  await author.configureButtonTrial("target", { branches: [author.id("final")] });
  await author.configureBranchConditions("source", [{
    id: 901, rules: [{ column: "response", op: "==", value: "0" }],
    nextTrialAlias: "target",
    customParameters: { stimulus: { source: "typed", value: '<main data-runtime-trial="selected">selected branch</main>' } },
  }]);
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  const sessionId = await runtime.sessionId();
  for (let row = 0; row < 2; row++) {
    await expect(runtime.trial("source")).toBeVisible();
    await runtime.continue();
    await expect(runtime.trial("selected")).toHaveText("selected branch");
    await runtime.waitForPersistence();
    await page.reload();
    await expect(runtime.trial("selected")).toHaveText("selected branch");
    await runtime.continue();
  }
  await expect(runtime.trial("final")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  expect(builderIds((await loadPersistedSession(author.experimentId, sessionId)).session.data)).toEqual(
    ["source", "target", "source", "target", "final"].map(alias => String(author.id(alias))),
  );
  await runtime.assertNoRuntimeFailures();
});

test("restores a conditional cycle within the second configured repetition", async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-conditional-resume-${Date.now()}`);
  for (const alias of ["source", "final"]) await author.createTrial(alias);
  await author.createLoop("conditional-loop", ["source"]);
  await author.client.updateLoop(author.experimentId, author.id("conditional-loop"), {
    csvJson: [{ row: 1 }], repetitions: 2,
  });
  await author.configureButtonTrial("source", {}, ["Repeat", "Continue"]);
  await author.configureButtonTrial("final");
  await author.configureConditionalLoop("conditional-loop", [{
    id: 902, rules: [{ trialAlias: "source", column: "response", op: "==", value: "0" }],
  }]);
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  const sessionId = await runtime.sessionId();
  await expect(runtime.trial("source")).toBeVisible();
  await runtime.choose("Continue");
  await expect(runtime.trial("source")).toBeVisible();
  await runtime.choose("Repeat");
  await expect(runtime.trial("source")).toBeVisible();
  await runtime.waitForPersistence();
  await page.reload();
  await expect(runtime.trial("source")).toBeVisible();
  await runtime.choose("Continue");
  await expect(runtime.trial("final")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  expect(builderIds((await loadPersistedSession(author.experimentId, sessionId)).session.data)).toEqual(
    ["source", "source", "source", "final"].map(alias => String(author.id(alias))),
  );
  await runtime.assertNoRuntimeFailures();
});
