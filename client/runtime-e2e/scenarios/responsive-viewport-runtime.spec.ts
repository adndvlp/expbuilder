import { expect, test, type Page } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { loadPersistedSession, runtimeApiBaseUrl } from "../support/session";
import { responsiveScene } from "../support/responsiveScene";
import { verifyResponsiveState } from "../support/responsiveStateCase";
import { verifyResponsiveHost } from "../support/responsiveHostCase";
import { verifyResponsiveTiming } from "../support/responsiveTimingCase";
import {
  verifyLateResponsiveImage,
  verifyResponsiveHandoff,
  verifyResponsiveIframe,
} from "../support/responsiveLifecycleCases";

async function sceneBounds(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(
      "#jspsych-dynamic-plugin-container",
    )!;
    const bounds = root.getBoundingClientRect();
    const rect = (selector: string) => {
      const r = Array.from(root.querySelectorAll(selector))
        .at(-1)!
        .getBoundingClientRect();
      return {
        x: r.x - bounds.x,
        y: r.y - bounds.y,
        width: r.width,
        height: r.height,
      };
    };
    const canvas = root.querySelector<HTMLCanvasElement>(
      "canvas.dynamic-canvas-stage",
    )!;
    return {
      root: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
      edge: rect(".dynamic-html-component-stimulus"),
      image: rect(".dynamic-image-component"),
      text: rect(".dynamic-text-component"),
      input: rect('input:not([type="range"])'),
      slider: rect('input[type="range"]'),
      buffer: { width: canvas.width, height: canvas.height },
      dpr: window.devicePixelRatio,
    };
  });
}

test(`[RUNTIME-RESPONSIVE-VIEWPORT] client expands beyond saved screens and preserves controls`, async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`responsive-client-${Date.now()}`);
  await author.createTrial("responsive");
  await author.configureDynamicTrial("responsive", responsiveScene());
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.setViewportSize({ width: 1440, height: 903 });
  await page.goto(artifact.experimentUrl);
  const root = page.locator("#jspsych-dynamic-plugin-container");
  await expect(root).toBeVisible();
  const input = root.locator('input:not([type="range"])').last();
  const slider = root.locator('input[type="range"]');
  await input.fill("Keep this answer");
  await slider.fill("73");
  await input.focus();
  await input.evaluate((element: HTMLInputElement) =>
    element.setSelectionRange(2, 9),
  );
  const originalInput = await input.elementHandle();
  const originalCanvas = await root
    .locator("canvas.dynamic-canvas-stage")
    .elementHandle();
  const geometries = [];
  for (const size of [
    { width: 1440, height: 903 },
    { width: 1478, height: 903 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 1004, height: 696 },
    { width: 1063, height: 696 },
    { width: 375, height: 725 },
    { width: 725, height: 375 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(async () => (await sceneBounds(page)).root.width)
      .toBeCloseTo(size.width, 0);
    const bounds = await sceneBounds(page);
    const scale = Math.min(size.width / 2560, size.height / 1450);
    const sceneWidth = 2560 * scale,
      sceneHeight = 1450 * scale;
    const offsetX = (size.width - sceneWidth) / 2,
      offsetY = (size.height - sceneHeight) / 2;
    expect(bounds.root.height).toBeCloseTo(size.height, 0);
    expect(bounds.edge.x).toBeGreaterThanOrEqual(0);
    expect(bounds.edge.x + bounds.edge.width).toBeLessThanOrEqual(size.width);
    expect(bounds.image.x + bounds.image.width / 2).toBeCloseTo(
      offsetX + sceneWidth * 0.75,
      0,
    );
    expect(bounds.image.y + bounds.image.height / 2).toBeCloseTo(
      offsetY + sceneHeight * 0.225,
      0,
    );
    expect(bounds.image.width).toBeCloseTo(sceneWidth * 0.1, 0);
    expect(bounds.text.width).toBeCloseTo(sceneWidth * 0.4, 0);
    expect(bounds.text.height).toBeCloseTo(sceneWidth * 0.03, 0);
    expect(bounds.input.width).toBeCloseTo(sceneWidth * 0.35, 0);
    expect(bounds.buffer.width).toBe(Math.round(sceneWidth * bounds.dpr));
    expect(bounds.buffer.height).toBe(Math.round(sceneHeight * bounds.dpr));
    await expect(input).toHaveValue("Keep this answer");
    await expect(slider).toHaveValue("73");
    expect(
      await input.evaluate(
        (element, original) => element === original,
        originalInput,
      ),
    ).toBe(true);
    expect(
      await input.evaluate((element: HTMLInputElement) => [
        document.activeElement === element,
        element.selectionStart,
        element.selectionEnd,
      ]),
    ).toEqual([true, 2, 9]);
    expect(
      await root
        .locator("canvas.dynamic-canvas-stage")
        .evaluate((element, original) => element === original, originalCanvas),
    ).toBe(true);
    geometries.push(bounds);
  }
  // Canvas buttons have retained hitboxes: use the current relative center.
  const lastScale = Math.min(725 / 2560, 375 / 1450);
  await page.mouse.click(
    (725 - 2560 * lastScale) / 2 + 2560 * lastScale * 0.775,
    (375 - 1450 * lastScale) / 2 + 1450 * lastScale * 0.85,
  );

  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  const row = session.data.find(
    (value: any) =>
      String(value.trial_id) === String(author.id("responsive")) ||
      String(value.builder_trial_id) === String(author.id("responsive")),
  );
  expect(row).toBeTruthy();
  expect(JSON.stringify(row)).toContain("Keep this answer");
  expect(JSON.stringify(row)).toContain("73");

  await test.info().attach("viewport-geometries", {
    body: JSON.stringify(geometries, null, 2),
    contentType: "application/json",
  });
  await runtime.assertNoRuntimeFailures();
});

test("resize preserves survey page, uploaded file, drawing and video playback", async ({
  page,
}) => {
  await verifyResponsiveState(page);
});

test("resize keeps a single scheduled onset and offset", async ({ page }) => {
  await verifyResponsiveTiming(page);
});

test("resizes the running artifact inside its iframe without restarting it", async ({
  page,
}) => {
  await verifyResponsiveIframe(page);
});

test("persistent image handoff uses current dimensions and releases its surfaces", async ({
  page,
}) => {
  await verifyResponsiveHandoff(page);
});

test("images loading after rapid resizes use the latest layout", async ({
  page,
}) => {
  await verifyLateResponsiveImage(page);
});

test.describe("embedded viewport at DPR 2", () => {
  test.use({ deviceScaleFactor: 2, hasTouch: true });
  test("waits for a visible host and respects offsets, progress, width and touch hitboxes", async ({
    page,
  }) => {
    await verifyResponsiveHost(page);
  });
});
