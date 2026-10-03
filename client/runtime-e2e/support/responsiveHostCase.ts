import { expect, type Page } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { compileScenarioArtifact } from "../authoring/compileScenarioArtifact";
import { scenarioAppearance } from "../authoring/scenarioTrialConfiguration";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { loadPersistedSession, runtimeApiBaseUrl } from "./session";
import { responsiveScene, typed } from "./responsiveScene";

export async function verifyResponsiveHost(page: Page) {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`responsive-host-${Date.now()}`);
  await author.createTrial("embedded");
  const scene = responsiveScene({ width: 1024, height: 768 });
  (scene.components.value as any[])[0].stimulus = typed(
    '<p style="margin:0;font-size:12px">HTML</p>',
  );
  await author.configureDynamicTrial("embedded", {
    ...scene,
    dynamic_csv_diagnostics: typed("debug"),
  });
  const artifact = await compileScenarioArtifact({
    apiBaseUrl: runtimeApiBaseUrl,
    client: author.client,
    experimentId: author.experimentId,
    appearance: { ...scenarioAppearance, progressBar: true },
    // The Builder's custom pre-init hook configures the real jsPsych host.
    customPreInitCode: `
      const host = document.createElement('div');
      host.id = 'embedded-host';
      host.style.cssText = 'position:fixed;left:60px;top:40px;width:980px;height:620px;display:none';
      document.body.appendChild(host);
      const originalInit = window.initJsPsych;
      window.initJsPsych = options => originalInit({ ...options, display_element: host, experiment_width: 640 });
    `,
  });
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(page.locator("#jspsych-dynamic-plugin-container")).toHaveCount(
    1,
  );
  await expect(page.locator("#jspsych-dynamic-plugin-container")).toBeHidden();
  await page.locator("#embedded-host").evaluate((host: HTMLElement) => {
    host.style.display = "";
  });
  const root = page.locator("#jspsych-dynamic-plugin-container");
  await expect(root).toBeVisible();
  const originalCanvas = await root
    .locator("canvas.dynamic-canvas-stage")
    .elementHandle();
  for (const width of [980, 500, 800]) {
    await page
      .locator("#embedded-host")
      .evaluate((host: HTMLElement, width) => {
        host.style.width = `${width}px`;
      }, width);
    await expect
      .poll(() => root.evaluate((element) => element.clientWidth))
      .toBe(Math.min(width, 640));
    const measured = await root.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const wrapper =
        element.parentElement!.parentElement!.getBoundingClientRect();
      const canvas = element.querySelector<HTMLCanvasElement>(
        "canvas.dynamic-canvas-stage",
      )!;
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        wrapperTop: wrapper.top,
        wrapperHeight: wrapper.height,
        bufferWidth: canvas.width,
        bufferHeight: canvas.height,
        dpr: devicePixelRatio,
      };
    });
    expect(measured.left).toBeCloseTo(
      60 + (width - Math.min(width, 640)) / 2,
      0,
    );
    expect(measured.top).toBeCloseTo(measured.wrapperTop, 0);
    expect(measured.height).toBeCloseTo(measured.wrapperHeight, 0);
    expect(measured.top).toBeGreaterThan(40); // progress bar owns its space
    expect(measured.bufferWidth).toBe(Math.round(measured.width * 2));
    expect(measured.bufferHeight).toBe(Math.round(measured.height * 2));
    expect(
      await root
        .locator("canvas.dynamic-canvas-stage")
        .evaluate((element, original) => element === original, originalCanvas),
    ).toBe(true);
  }
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 3,
    mobile: false,
  });
  await expect
    .poll(() =>
      root
        .locator("canvas")
        .evaluate((canvas: HTMLCanvasElement) => canvas.width),
    )
    .toBe(640 * 3);
  await page
    .locator("#embedded-host")
    .evaluate((host: HTMLElement) => host.requestFullscreen());
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id))
    .toBe("embedded-host");
  await expect
    .poll(() =>
      root.evaluate((element) => element.getBoundingClientRect().left),
    )
    .toBe(320);
  await page.evaluate(() => document.exitFullscreen());
  await expect
    .poll(() =>
      root.evaluate((element) => element.getBoundingClientRect().left),
    )
    .toBe(140);
  expect(
    await root
      .locator("canvas")
      .evaluate((element, original) => element === original, originalCanvas),
  ).toBe(true);
  const bounds = (await root.boundingBox())!;
  await page.touchscreen.tap(
    bounds.x + bounds.width * 0.775,
    bounds.y + bounds.height * 0.85,
  );
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session: persisted } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  const row = persisted.data.find(
    (value) => String(value.builder_id) === String(author.id("embedded")),
  )!;
  expect(row.response_device).toBe("touch");
  expect(Number(row.response_canvas_x)).toBeCloseTo(bounds.width * 0.775, 0);
  expect(Number(row.response_canvas_y)).toBeCloseTo(bounds.height * 0.85, 0);
  await runtime.assertNoRuntimeFailures();
}
