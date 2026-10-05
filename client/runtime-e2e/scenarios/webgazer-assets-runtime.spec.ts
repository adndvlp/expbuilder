import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { runtimeApiBaseUrl } from "../support/session";

test.use({ video: "off" });

test("ordinary trials finish without loading Webgazer or its models", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`no-eye-tracking-${Date.now()}`);
  await author.createTrial("plain");
  await author.configureButtonTrial("plain");
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  await runtime.waitForPersistence();
  expect(
    requests.filter((url) => /webgazer|kagglesdsdata\/models/.test(url)),
  ).toEqual([]);
  expect(await page.evaluate(() => "webgazer" in window)).toBe(false);
  await runtime.assertNoRuntimeFailures();
});
