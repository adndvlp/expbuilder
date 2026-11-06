import { expect, test, type Page } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { loadPersistedSession, runtimeApiBaseUrl } from "../support/session";
import { image, typed } from "../support/responsiveScene";
import { publishScenarioArtifact } from "../support/publishScenarioArtifact";

test.use({ video: "off" });

async function createWelcome(page: Page, timing = true) {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`proportional-${Date.now()}`);
  await author.createTrial("welcome");
  await author.configureDynamicTrial("welcome", {
    components: typed([
      {
        type: "TextComponent",
        name: typed("welcome"),
        text: typed("Welcome"),
        coordinates: { x: 0, y: 60 },
        width: 60,
        _font_size_runtime_vw: typed(2.5),
      },
      {
        type: "ImageComponent",
        name: typed("picture"),
        stimulus: typed(image),
        coordinates: { x: 0, y: 0 },
        width: 20,
        height: 20,
      },
    ]),
    response_components: typed([
      {
        type: "ButtonResponseComponent",
        name: typed("continue"),
        choices: typed(["Continue"]),
        coordinates: { x: 0, y: -60 },
        width: 20,
        height: 5,
        _button_font_size_runtime_vw: typed(2),
      },
    ]),
    response_ends_trial: typed(true),
    dynamic_csv_diagnostics: typed("debug"),
  });
  if (!timing)
    await author.session
      .canvasDependencies()
      .updateTrial(author.id("welcome"), {
        customOnStart: "trial.response_timing_enabled = false;",
      });
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  return { author, artifact, runtime };
}

test("a welcome composition scales together, grows and preserves real response coordinates", async ({
  page,
}) => {
  const { author, artifact, runtime } = await createWelcome(page);
  await page.setViewportSize({ width: 2560, height: 1450 });
  await page.goto(artifact.experimentUrl);
  const picture = page.locator(".dynamic-image-component");
  const text = page.locator(".dynamic-text-component");
  await expect(picture).toBeVisible();
  for (const size of [
    { width: 2560, height: 1450 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 3840, height: 2160 },
  ]) {
    await page.setViewportSize(size);
    const scale = Math.min(size.width / 2560, size.height / 1450);
    await expect
      .poll(async () => (await picture.boundingBox())!.width)
      .toBeCloseTo(512 * scale, 0);
    const p = (await picture.boundingBox())!;
    const t = (await text.boundingBox())!;
    // Measured cross-component ratio, independent of production geometry helpers.
    expect((p.y + p.height / 2 - (t.y + t.height / 2)) / p.width).toBeCloseTo(
      435 / 512,
      2,
    );
    const canvas = await page
      .locator("canvas.dynamic-canvas-stage")
      .first()
      .evaluate((element: HTMLCanvasElement) => ({
        width: element.width,
        height: element.height,
        dpr: devicePixelRatio,
      }));
    expect(canvas.width).toBe(Math.round(2560 * scale * canvas.dpr));
    expect(canvas.height).toBe(Math.round(1450 * scale * canvas.dpr));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => (await picture.boundingBox())!.width)
    .toBeCloseTo(78, 0);
  const expectedX = 195;
  const expectedY = (844 - 1450 * (390 / 2560)) / 2 + 1160 * (390 / 2560);
  // A click in the letterbox does not hit a canvas button.
  await page.mouse.click(195, 20);
  await expect(picture).toBeVisible();
  await page.mouse.click(expectedX, expectedY);
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  const row = session.data.find(
    (value) => String(value.builder_id) === String(author.id("welcome")),
  )!;
  expect(Number(row.response_canvas_x)).toBeCloseTo(expectedX, 0);
  expect(Number(row.response_canvas_y)).toBeCloseTo(expectedY, 0);
  expect(JSON.parse(String(row.picture_size)).width).toBeCloseTo(78, 0);
  expect(JSON.parse(String(row.continue_size)).width).toBeCloseTo(78, 0);
  expect(JSON.parse(String(row.welcome_coordinates)).y).toBeCloseTo(
    (844 - 1450 * (390 / 2560)) / 2 + 290 * (390 / 2560),
    0,
  );
  await runtime.assertNoRuntimeFailures();
});

test("scaled DOM buttons respond without response timing", async ({ page }) => {
  const { author, artifact, runtime } = await createWelcome(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(artifact.experimentUrl);
  const button = page.getByRole("button", { name: "Continue", exact: true });
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  expect(box.width).toBeCloseTo(78, 0);
  await button.click();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  const row = session.data.find(
    (value) => String(value.builder_id) === String(author.id("welcome")),
  )!;
  expect(row.continue_response).toBe("Continue");
  expect(row.response_timing_enabled).toBe(false);
  await runtime.assertNoRuntimeFailures();
});

test("the real publication route produces a proportional artifact with the new plugin", async ({
  page,
}) => {
  const { author, artifact, runtime } = await createWelcome(page);
  const url = await publishScenarioArtifact(
    page,
    author.experimentId,
    artifact.experimentUrl,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  const picture = page.locator(".dynamic-image-component");
  await expect(picture).toBeVisible();
  const box = (await picture.boundingBox())!;
  expect(box.width).toBeCloseTo(78, 0);
  expect(box.y + box.height / 2).toBeCloseTo(422, 0);
  await page.mouse.click(
    195,
    (844 - 1450 * (390 / 2560)) / 2 + 1160 * (390 / 2560),
  );
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  await runtime.assertNoRuntimeFailures();
});

test("explicit full-host click capture includes the letterbox", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`proportional-capture-${Date.now()}`);
  await author.createTrial("capture");
  await author.configureDynamicTrial("capture", {
    components: typed([]),
    response_components: typed([
      {
        type: "ClickResponseComponent",
        name: typed("capture"),
        capture_full_screen: typed(true),
        relative_to_element: typed(true),
      },
    ]),
    response_ends_trial: typed(true),
    dynamic_csv_diagnostics: typed("debug"),
  });
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(artifact.experimentUrl);
  await expect(page.locator("#jspsych-dynamic-plugin-container")).toBeVisible();
  await page.mouse.click(195, 20);
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  const row = session.data.find(
    (value) => String(value.builder_id) === String(author.id("capture")),
  )!;
  expect(Number(row.response_canvas_y)).toBeCloseTo(20, 0);
  expect(JSON.parse(String(row.capture_response))).toMatchObject({
    x: 195,
    y: 20,
  });
  await runtime.assertNoRuntimeFailures();
});

test.describe("touch and initial buffers at DPR 3", () => {
  test.use({ deviceScaleFactor: 3, hasTouch: true });
  test("allocates at visible resolution from the start and hits the scaled canvas button", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(window, "canvasAllocations", { value: [] });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        value: function (this: HTMLCanvasElement, ...args: unknown[]) {
          (
            window as unknown as {
              canvasAllocations: { width: number; height: number }[];
            }
          ).canvasAllocations.push({ width: this.width, height: this.height });
          return Reflect.apply(original, this, args);
        },
      });
    });
    const { author, artifact, runtime } = await createWelcome(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(artifact.experimentUrl);
    await expect(page.locator(".dynamic-image-component")).toBeVisible();
    const allocations = await page.evaluate(
      () =>
        (
          window as unknown as {
            canvasAllocations: { width: number; height: number }[];
          }
        ).canvasAllocations,
    );
    expect(allocations.length).toBeGreaterThan(0);
    expect(
      Math.max(...allocations.map((value) => value.width)),
    ).toBeLessThanOrEqual(1171);
    expect(
      Math.max(...allocations.map((value) => value.height)),
    ).toBeLessThanOrEqual(664);
    const expectedY = (844 - 1450 * (390 / 2560)) / 2 + 1160 * (390 / 2560);
    await page.touchscreen.tap(195, expectedY);
    await expect(
      page.getByText("Experiment complete. Thank you!"),
    ).toBeVisible();
    const { session } = await loadPersistedSession(
      author.experimentId,
      await runtime.sessionId(),
    );
    const row = session.data.find(
      (value) => String(value.builder_id) === String(author.id("welcome")),
    )!;
    expect(row.response_device).toBe("touch");
    expect(Number(row.response_canvas_x)).toBeCloseTo(195, 0);
    expect(Number(row.response_canvas_y)).toBeCloseTo(expectedY, 0);
    await runtime.assertNoRuntimeFailures();
  });
});
