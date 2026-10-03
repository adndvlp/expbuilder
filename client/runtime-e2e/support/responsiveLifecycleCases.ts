import { expect, type Page } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { loadPersistedSession, runtimeApiBaseUrl } from "./session";
import { image, responsiveScene, typed } from "./responsiveScene";

export async function verifyResponsiveIframe(page: Page) {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`responsive-iframe-${Date.now()}`);
  await author.createTrial("iframe");
  await author.configureDynamicTrial("iframe", responsiveScene());
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.route("**/favicon.ico", route => route.fulfill({ status: 204 }));
  // Give the parent the local server's origin; Chrome blocks an opaque public
  // about:blank document from initiating local-network iframe navigation.
  await page.goto(`${runtimeApiBaseUrl}/api/load-experiments`);
  await page.evaluate(() => {
    document.body.replaceChildren();
  });
  await page.evaluate((url) => {
    const iframe = document.createElement("iframe");
    iframe.id = "runtime-preview";
    iframe.style.cssText = "width:1440px;height:903px;border:0";
    iframe.src = url;
    document.body.appendChild(iframe);
  }, artifact.experimentUrl);
  const frame = page.frameLocator("#runtime-preview");
  const root = frame.locator("#jspsych-dynamic-plugin-container");
  const input = root.locator('input:not([type="range"])').last();
  await input.fill("Iframe answer");
  const originalRoot = await root.elementHandle();
  for (const size of [
    { width: 1478, height: 903 },
    { width: 1063, height: 696 },
    { width: 375, height: 725 },
  ]) {
    await page
      .locator("#runtime-preview")
      .evaluate((iframe: HTMLIFrameElement, size) => {
        iframe.style.width = `${size.width}px`;
        iframe.style.height = `${size.height}px`;
      }, size);
    await expect
      .poll(() => root.evaluate((element) => element.clientWidth))
      .toBe(size.width);
    await expect
      .poll(() => root.evaluate((element) => element.clientHeight))
      .toBe(size.height);
    expect(
      await root.evaluate(
        (element, original) => element === original,
        originalRoot,
      ),
    ).toBe(true);
    await expect(input).toHaveValue("Iframe answer");
    const marker = await root.locator(".dynamic-image-component").boundingBox();
    expect(marker!.width).toBeCloseTo(size.width * 0.1, 0);
  }
  await runtime.assertNoRuntimeFailures();
}

export async function verifyResponsiveHandoff(page: Page) {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`responsive-handoff-${Date.now()}`);
  for (let index = 0; index < 3; index++) {
    await author.createTrial(`frame-${index}`);
    await author.configureDynamicTrial(`frame-${index}`, {
      components: typed([
        {
          type: "ImageComponent",
          name: typed(`frame-${index}`),
          coordinates: { x: 50, y: 50 },
          width: 10,
          height: 10,
          stimulus: typed(image),
        },
      ]),
      trial_duration: typed(1000),
      dynamic_csv_diagnostics: typed("stimulus"),
    });
  }
  await author.createTrial("tail");
  await author.configureButtonTrial("tail");
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  const surface = page.locator("#jspsych-dynamic-persistent-visual");
  await expect(surface.locator("canvas")).toHaveCount(1);
  const originalCanvas = await surface.locator("canvas").elementHandle();
  for (const [index, width] of [1478, 1920, 1063].entries()) {
    await expect(
      page.locator(`#jspsych-dynamic-frame-${index}-stimulus`),
    ).toBeVisible();
    await page.setViewportSize({ width, height: 903 });
    await expect
      .poll(() => surface.evaluate((element) => element.clientWidth))
      .toBe(width);
    const rect = await page
      .locator(`#jspsych-dynamic-frame-${index}-stimulus`)
      .boundingBox();
    expect(rect!.x + rect!.width / 2).toBeCloseTo(width * 0.75, 0);
    expect(rect!.width).toBeCloseTo(width * 0.1, 0);
    expect(
      await surface
        .locator("canvas")
        .evaluate((element, original) => element === original, originalCanvas),
    ).toBe(true);
    await expect(page.locator("#jspsych-dynamic-visual-bridge")).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  await expect(surface).toHaveCount(0);
  await expect(page.locator("#jspsych-dynamic-visual-bridge")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  for (let index = 0; index < 3; index++) {
    const row = session.data.find(
      (value) =>
        String(value.builder_id) === String(author.id(`frame-${index}`)),
    )!;
    expect(JSON.parse(String(row.stimulus_timing))).toHaveLength(1);
    expect(Math.abs(Number(row.actual_trial_duration) - 1000)).toBeLessThan(70);
  }
  await runtime.assertNoRuntimeFailures();
}

export async function verifyLateResponsiveImage(page: Page) {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`responsive-late-${Date.now()}`);
  await author.createTrial("late");
  const scene = responsiveScene();
  const assetUrl = `${runtimeApiBaseUrl}/responsive-delayed.png`;
  (scene.components.value as any[])[1].stimulus = typed(assetUrl);
  await author.configureDynamicTrial("late", scene);
  await author.session.canvasDependencies().updateTrial(author.id("late"), {
    customOnStart: "trial.preload_assets = false;",
  });
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(assetUrl, async (route) => {
    await pending;
    await route.fulfill({
      contentType: "image/png",
      body: Buffer.from(image.split(",")[1], "base64"),
    });
  });
  await page.goto(artifact.experimentUrl, { waitUntil: "domcontentloaded" });
  const root = page.locator("#jspsych-dynamic-plugin-container");
  await expect(root).toBeVisible();
  for (const width of [1440, 1478, 1920, 1063])
    await page.setViewportSize({ width, height: 696 });
  await expect
    .poll(() => root.evaluate((element) => element.clientWidth))
    .toBe(1063);
  release();
  const marker = root.locator(".dynamic-image-component");
  await expect(marker).toBeVisible();
  await expect
    .poll(async () => (await marker.boundingBox())!.width)
    .toBeCloseTo(106.3, 0);
  expect(
    (await marker.boundingBox())!.x + (await marker.boundingBox())!.width / 2,
  ).toBeCloseTo(1063 * 0.75, 0);
  await expect(root.locator("canvas.dynamic-canvas-stage")).toHaveCount(1);
  await page.mouse.click(1063 * 0.775, 696 * 0.85);
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  await expect(page.locator("#jspsych-dynamic-visual-bridge")).toHaveCount(0);
  await runtime.assertNoRuntimeFailures();
}
