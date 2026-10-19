import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { localRuntimeStorageKeys, runtimeApiBaseUrl } from "../support/session";

for (const corruption of ["revision", "destination"]) {
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
    const key = localRuntimeStorageKeys(author.experimentId).resumeTrial;
    await page.evaluate(({ key, corruption }) => {
      const saved = JSON.parse(localStorage.getItem(key)!);
      if (corruption === "revision") saved.experimentRevision = "another-revision";
      else saved.cursor.targetId = "missing-destination";
      localStorage.setItem(key, JSON.stringify(saved));
    }, { key, corruption });
    let reloads = 0;
    page.on("framenavigated", () => reloads++);
    await page.reload();
    await expect(page.getByText("The experiment could not continue")).toBeVisible();
    await expect(runtime.trial("First")).toHaveCount(0);
    await expect(runtime.trial("Second")).toHaveCount(0);
    expect(reloads).toBe(1);
  });
}
