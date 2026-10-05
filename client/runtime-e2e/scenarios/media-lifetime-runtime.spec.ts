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

const audioUrl = `${runtimeApiBaseUrl}/lifetime-media/sound.wav?signature=one&token=two`;
const videoUrl = `${runtimeApiBaseUrl}/lifetime-media/clip.webm?signature=one&token=two`;
test.use({ video: "off" });

for (const htmlAudio of [false, true]) {
  test(`releases ${htmlAudio ? "HTML" : "WebAudio"} audio after trial 1 and prepares it again for Dynamic trial 7`, async ({
    page,
  }) => {
    const requests: string[] = [];
    await page.route("**/lifetime-media/**", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({ contentType: "audio/wav", body: audioFixture() });
    });
    const author = new ScenarioAuthor(runtimeApiBaseUrl);
    await author.createExperiment(`audio-lifetime-${htmlAudio}-${Date.now()}`);
    for (let index = 1; index <= 7; index++) {
      const alias = `trial-${index}`;
      await author.createTrial(alias);
      if (index === 1) {
        await author.client.updateTrial(author.experimentId, author.id(alias), {
          plugin: "plugin-audio-button-response",
          parameters: {},
          columnMapping: {
            stimulus: typed(audioUrl),
            choices: typed(["Continue"]),
          },
        });
      } else if (index === 7) {
        await author.configureDynamicTrial(alias, {
          components: typed([
            {
              type: "AudioComponent",
              name: "revisited",
              stimulus: audioUrl,
              autoplay: true,
            },
          ]),
          trial_duration: typed(800),
          prefetch_next_trials: typed(false),
        });
      } else await author.configureButtonTrial(alias);
    }
    const artifact = await author.compileAndBuild();
    await installMediaLifetimeProbe(page, htmlAudio);
    const runtime = new RuntimeObserver(page);
    await page.goto(artifact.experimentUrl);
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => (await mediaInventory(page)).audioStarts)
      .toBe(1);
    expect((await mediaInventory(page)).audio).toBe(1);
    await runtime.continue();
    for (let index = 2; index <= 6; index++) {
      await expect(runtime.trial(`trial-${index}`)).toBeVisible();
      await expect.poll(async () => (await mediaInventory(page)).audio).toBe(0);
      await runtime.continue();
    }
    await expect
      .poll(async () => (await mediaInventory(page)).audioStarts)
      .toBe(2);
    await expect(
      page.getByText("Experiment complete. Thank you!"),
    ).toBeVisible();
    expect(requests).toEqual([audioUrl, audioUrl]);
    expect(await mediaInventory(page)).toMatchObject({
      audio: 0,
      video: 0,
      users: 0,
      pending: 0,
    });
    const { session } = await loadPersistedSession(
      author.experimentId,
      await runtime.sessionId(),
    );
    expect(builderIds(session.data)).toEqual(
      Array.from({ length: 7 }, (_, i) => String(author.id(`trial-${i + 1}`))),
    );
    await runtime.assertNoRuntimeFailures();
  });
}

test("revokes video Blobs between standard and Dynamic trials and reloads the exact signed URL", async ({
  page,
}) => {
  const data = await createResponsiveVideo();
  const bytes = Buffer.from(data.split(",")[1], "base64");
  const requests: string[] = [];
  await page.route("**/lifetime-media/**", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: "video/webm", body: bytes });
  });
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`video-lifetime-${Date.now()}`);
  for (const alias of ["standard", "gap", "dynamic"])
    await author.createTrial(alias);
  await author.client.updateTrial(author.experimentId, author.id("standard"), {
    plugin: "plugin-video-button-response",
    parameters: {},
    columnMapping: {
      stimulus: typed([videoUrl]),
      choices: typed(["Continue"]),
      autoplay: typed(false),
    },
  });
  await author.configureButtonTrial("gap");
  await author.configureDynamicTrial("dynamic", {
    components: typed([
      {
        type: "VideoComponent",
        name: "revisited",
        stimulus: [videoUrl],
        autoplay: false,
        controls: true,
      },
    ]),
    trial_duration: typed(1000),
    prefetch_next_trials: typed(false),
  });
  const artifact = await author.compileAndBuild();
  await installMediaLifetimeProbe(page);
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate((element) => (element as HTMLVideoElement).readyState),
    )
    .toBeGreaterThanOrEqual(2);
  expect((await mediaInventory(page)).created).toHaveLength(1);
  await runtime.continue();
  await expect(runtime.trial("gap")).toBeVisible();
  const gap = await mediaInventory(page);
  expect(gap.video).toBe(0);
  expect(gap.revoked).toContain(gap.created[0]);
  await runtime.continue();
  await expect(
    page.locator("#jspsych-dynamic-revisited-stimulus"),
  ).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate((element) => (element as HTMLVideoElement).readyState),
    )
    .toBeGreaterThanOrEqual(2);
  expect((await mediaInventory(page)).created).toHaveLength(2);
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const final = await mediaInventory(page);
  expect(final.created.every((url) => final.revoked.includes(url))).toBe(true);
  expect(final).toMatchObject({ audio: 0, video: 0, users: 0, pending: 0 });
  expect(requests).toEqual([videoUrl, videoUrl]);
  await runtime.assertNoRuntimeFailures();
});

test("keeps an explicit preload's audio/video until consumed and frees its unused media on completion", async ({
  page,
}) => {
  const data = await createResponsiveVideo();
  const requests: string[] = [];
  await page.route("**/lifetime-media/**", async (route) => {
    requests.push(route.request().url());
    const video = route.request().url().includes(".webm");
    await route.fulfill({
      contentType: video ? "video/webm" : "audio/wav",
      body: video ? Buffer.from(data.split(",")[1], "base64") : audioFixture(),
    });
  });
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`manual-media-lifetime-${Date.now()}`);
  for (const alias of ["preload", "audio", "gap"])
    await author.createTrial(alias);
  await author.client.updateTrial(author.experimentId, author.id("preload"), {
    plugin: "plugin-preload",
    parameters: {},
    columnMapping: { audio: typed([audioUrl]), video: typed([videoUrl]) },
  });
  await author.client.updateTrial(author.experimentId, author.id("audio"), {
    plugin: "plugin-audio-button-response",
    parameters: {},
    columnMapping: { stimulus: typed(audioUrl), choices: typed(["Continue"]) },
  });
  await author.configureButtonTrial("gap");
  const artifact = await author.compileAndBuild();
  await installMediaLifetimeProbe(page);
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  expect(requests.sort()).toEqual([audioUrl, videoUrl].sort());
  expect(await mediaInventory(page)).toMatchObject({ audio: 1, video: 1 });
  await runtime.continue();
  await expect(runtime.trial("gap")).toBeVisible();
  expect(await mediaInventory(page)).toMatchObject({ audio: 0, video: 1 });
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const final = await mediaInventory(page);
  expect(final).toMatchObject({ audio: 0, video: 0, users: 0, pending: 0 });
  expect(final.revoked).toContain(final.created[0]);
  await runtime.assertNoRuntimeFailures();
});
