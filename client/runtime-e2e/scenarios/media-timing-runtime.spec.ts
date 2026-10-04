import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { typed } from "../support/responsiveScene";
import { loadPersistedSession, runtimeApiBaseUrl } from "../support/session";

test.use({ video: "off" });

test("does not subtract preparation time from a later image's measured presentation", async ({
  page,
}) => {
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kwAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.route("**/slow-media/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ contentType: "image/png", body: image });
  });
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`media-timing-${Date.now()}`);
  for (let index = 0; index < 3; index++) {
    const name = `slow-${index}`;
    await author.createTrial(name);
    await author.configureDynamicTrial(name, {
      components: typed([
        {
          type: "ImageComponent",
          name,
          stimulus: `${runtimeApiBaseUrl}/slow-media/${index}.png`,
          coordinates: { x: 0, y: 0 },
          width: 10,
          height: 10,
        },
      ]),
      trial_duration: typed(700),
      dynamic_csv_diagnostics: typed("stimulus"),
    });
    await author.client.updateTrial(author.experimentId, author.id(name), {
      customOnStart: "trial.prefetch_next_trials = false;",
    });
  }
  await author.createTrial("finish");
  await author.configureButtonTrial("finish");
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  for (let index = 0; index < 3; index++)
    await expect(
      page.locator(`#jspsych-dynamic-slow-${index}-stimulus`),
    ).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  const rows = session.data.filter((row) =>
    String(row.trial_name).startsWith("slow-"),
  );
  expect(rows).toHaveLength(3);
  for (const row of rows) {
    const timing = JSON.parse(String(row.stimulus_timing));
    expect(timing).toHaveLength(1);
    expect(Math.abs(Number(row.actual_trial_duration) - 700)).toBeLessThan(70);
    expect(Number(timing[0].actual_duration)).toBeGreaterThan(630);
  }
  await runtime.assertNoRuntimeFailures();
});
