import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { typed } from "../support/responsiveScene";
import { createResponsiveVideo } from "../support/responsiveVideo";
import {
  runtimeApiBaseUrl,
  loadPersistedSession,
  builderIds,
} from "../support/session";
import {
  audioFixture,
  installMediaLifetimeProbe,
  mediaInventory,
} from "../support/mediaLifetimeProbe";

test.use({ video: "off" });

test("bounds shared audio/video resources through a Dynamic prefetch window and releases the final window", async ({
  page,
}) => {
  const data = await createResponsiveVideo();
  const videoBytes = Buffer.from(data.split(",")[1], "base64");
  await page.route("**/prefetch-media/**", async (route) => {
    const video = route.request().url().includes(".webm");
    await route.fulfill({
      contentType: video ? "video/webm" : "audio/wav",
      body: video ? videoBytes : audioFixture(),
    });
  });
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`media-prefetch-lifetime-${Date.now()}`);
  const audioIds = [0, 1, 2, 0, 3, 4, 0];
  const videoIds = [0, 1, 0, 2, 3, 0, 4];
  for (let index = 0; index < audioIds.length; index++) {
    const alias = `media-${index}`;
    await author.createTrial(alias);
    await author.configureDynamicTrial(alias, {
      components: typed([
        {
          type: "AudioComponent",
          name: `audio-${index}`,
          stimulus: `${runtimeApiBaseUrl}/prefetch-media/audio-${audioIds[index]}.wav`,
          autoplay: true,
        },
        {
          type: "VideoComponent",
          name: `video-${index}`,
          stimulus: [
            `${runtimeApiBaseUrl}/prefetch-media/video-${videoIds[index]}.webm`,
          ],
          autoplay: false,
          controls: true,
          width: 30,
        },
      ]),
      trial_duration: typed(1100),
      dynamic_csv_diagnostics: typed("stimulus"),
    });
  }
  const artifact = await author.compileAndBuild();
  await installMediaLifetimeProbe(page);
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  for (let index = 0; index < audioIds.length; index++) {
    const video = page.locator(`#jspsych-dynamic-video-${index}-stimulus`);
    await expect(video).toBeVisible();
    await expect
      .poll(() =>
        video.evaluate((element) => (element as HTMLVideoElement).readyState),
      )
      .toBeGreaterThanOrEqual(2);
    const source = await video.getAttribute("src");
    const inventory = await mediaInventory(page);
    expect(inventory.audio).toBeLessThanOrEqual(4);
    expect(inventory.video).toBeLessThanOrEqual(4);
    expect(inventory.revoked).not.toContain(source);
  }
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const final = await mediaInventory(page);
  expect(final).toMatchObject({
    audio: 0,
    video: 0,
    users: 0,
    pending: 0,
    audioStarts: 7,
  });
  expect(final.created.every((url) => final.revoked.includes(url))).toBe(true);
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(session.data)).toEqual(
    audioIds.map((_, index) => String(author.id(`media-${index}`))),
  );
  for (const row of session.data.filter((row) => row.builder_id))
    expect(Math.abs(Number(row.actual_trial_duration) - 1100)).toBeLessThan(70);
  await runtime.assertNoRuntimeFailures();
});
