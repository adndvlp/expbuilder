import { expect, test } from "@playwright/test";
import { compileAgentScenarioArtifact } from "../authoring/compileAgentScenarioArtifact";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { builderIds, loadPersistedSession, runtimeApiBaseUrl } from "../support/session";

for (const generator of ["client", "agent"] as const) {
  test(`[RUNTIME-LOOP-CSV-REPETITIONS] ${generator} executes every CSV row in order for every repetition`, async ({ page }) => {
    const author = new ScenarioAuthor(runtimeApiBaseUrl);
    await author.createExperiment(`runtime-csv-${generator}-${Date.now()}`);
    await author.createTrial("csv-source");
    await author.createTrial("csv-tail");
    await author.createLoop("csv-loop", ["csv-source", "csv-tail"]);
    const rows = ["row1", "row2", "row3"].map(row => ({
      stimulus: `<main data-runtime-trial="csv-source">${row}</main>`,
    }));
    await author.client.updateLoop(author.experimentId, author.id("csv-loop"), {
      csvJson: rows, repetitions: 2, randomize: false,
    });
    await author.configureButtonTrial("csv-source", {
      csvFromLoop: true,
      columnMapping: {
        stimulus: { source: "csv", value: "stimulus" },
        choices: { source: "typed", value: ["Continue"] },
      },
    });
    await author.configureButtonTrial("csv-tail", { csvFromLoop: false });
    const artifact = generator === "client"
      ? await author.compileAndBuild()
      : await compileAgentScenarioArtifact(author);
    const runtime = new RuntimeObserver(page);
    await page.goto(artifact.experimentUrl);
    for (const row of ["row1", "row2", "row3", "row1", "row2", "row3"]) {
      await expect(runtime.trial("csv-source")).toHaveText(row);
      await runtime.continue();
      await expect(runtime.trial("csv-tail")).toBeVisible();
      await runtime.continue();
    }
    let data;
    if (generator === "client") {
      await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
      data = (await loadPersistedSession(author.experimentId, await runtime.sessionId())).session.data;
    } else {
      await expect(page.getByText("Agent complete")).toBeVisible();
      data = await page.evaluate(() => (window as unknown as { agentRows: Record<string, unknown>[] }).agentRows);
    }
    expect(builderIds(data)).toEqual(Array.from({ length: 6 }, () => [
      String(author.id("csv-source")), String(author.id("csv-tail")),
    ]).flat());
    await runtime.assertNoRuntimeFailures();
  });
}

for (const generator of ["client", "agent"] as const) {
  test(`[RUNTIME-LOOP-CSV-BRANCH] ${generator} trial branches select a path independently on each CSV row and repetition`, async ({ page }) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`runtime-csv-branch-${Date.now()}`);
  for (const alias of ["row-source", "row-target", "row-skipped"]) await author.createTrial(alias);
  await author.createLoop("row-loop", ["row-source", "row-target", "row-skipped"]);
  await author.client.updateLoop(author.experimentId, author.id("row-loop"), {
    csvJson: [{ row: 1 }, { row: 2 }], repetitions: 2,
  });
  await author.configureButtonTrials(["row-source", "row-target", "row-skipped"]);
  await author.configureButtonTrial("row-source", { branches: [author.id("row-target")] });
  const artifact = generator === "client"
    ? await author.compileAndBuild()
    : await compileAgentScenarioArtifact(author);
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  for (let index = 0; index < 4; index++) {
    await expect(runtime.trial("row-source")).toBeVisible();
    await runtime.continue();
    await expect(runtime.trial("row-target")).toBeVisible();
    await runtime.continue();
  }
  await expect(runtime.trial("row-skipped")).toHaveCount(0);
  let data;
  if (generator === "client") {
    await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
    data = (await loadPersistedSession(author.experimentId, await runtime.sessionId())).session.data;
  } else {
    await expect(page.getByText("Agent complete")).toBeVisible();
    data = await page.evaluate(() => (window as unknown as { agentRows: Record<string, unknown>[] }).agentRows);
  }
  expect(builderIds(data)).toEqual(Array.from({ length: 4 }, () => [
    String(author.id("row-source")), String(author.id("row-target")),
  ]).flat());
  await runtime.assertNoRuntimeFailures();
});

}
