import { expect, type Page } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { loadPersistedSession, runtimeApiBaseUrl } from "./session";
import { typed } from "./responsiveScene";

export async function verifyResponsiveTiming(page: Page) {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`responsive-timing-${Date.now()}`);
  await author.createTrial("timed");
  await author.configureDynamicTrial("timed", {
    components: typed([
      {
        type: "HtmlComponent",
        name: typed("timed"),
        coordinates: { x: 0, y: 0 },
        stimulus: typed("<p>Scheduled stimulus</p>"),
        stimulus_onset: typed(600),
        stimulus_duration: typed(700),
      },
    ]),
    trial_duration: typed(1800),
    dynamic_csv_diagnostics: typed("stimulus"),
  });
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  const stimulus = page.locator("#jspsych-dynamic-timed-stimulus");
  await expect(stimulus).toHaveCount(1);
  await expect(stimulus).toBeHidden();
  await page.setViewportSize({ width: 1478, height: 903 });
  await expect(stimulus).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(stimulus).toBeHidden();
  await page.setViewportSize({ width: 1063, height: 696 });
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  const row = session.data.find(
    (value) => String(value.builder_id) === String(author.id("timed")),
  )!;
  const records = JSON.parse(String(row.stimulus_timing));
  expect(records).toHaveLength(1);
  expect(Math.abs(Number(row.actual_trial_duration) - 1800)).toBeLessThan(70);
  expect(Math.abs(records[0].actual_onset - 600)).toBeLessThan(70);
  expect(Math.abs(records[0].actual_offset - 1300)).toBeLessThan(70);
  expect(records[0].actual_onset_abs).toBeGreaterThan(0);
  await runtime.assertNoRuntimeFailures();
}
