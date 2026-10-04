import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { typed } from "../support/responsiveScene";
import { loadPersistedSession, runtimeApiBaseUrl } from "../support/session";
import {
  gpuInventory,
  installGpuLifetimeProbe,
} from "../support/gpuLifetimeProbe";

test.use({ video: "off" });

test("reuses the image surface, retires old textures and disposes bridged contexts", async ({
  page,
}) => {
  const images = await page.evaluate(() =>
    ["red", "green", "blue"].map((color) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 32, 32);
      return canvas.toDataURL();
    }),
  );
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`gpu-lifetime-${Date.now()}`);
  for (let index = 0; index < 5; index++) {
    const name = `frame-${index}`;
    await author.createTrial(name);
    await author.configureDynamicTrial(name, {
      components: typed([
        {
          type: "ImageComponent",
          name: typed(name),
          coordinates: { x: 0, y: 0 },
          width: 10,
          height: 10,
          stimulus: typed(images[index % images.length]),
        },
      ]),
      dynamic_csv_diagnostics: typed("stimulus"),
      ...(index < 3
        ? { trial_duration: typed(1200) }
        : {
            response_components: typed([
              {
                type: "ButtonResponseComponent",
                name: typed("finish"),
                component_id: "finish",
                coordinates: { x: 0, y: -60 },
                choices: typed(["Continue"]),
                width: 18,
                height: 6,
              },
            ]),
            response_ends_trial: typed(true),
          }),
    });
  }
  await author.createTrial("tail");
  await author.configureButtonTrial("tail");
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await installGpuLifetimeProbe(page);
  await page.goto(artifact.experimentUrl);
  const surface = page.locator("#jspsych-dynamic-persistent-visual");
  await expect(surface.locator("canvas")).toHaveCount(1);
  const original = await surface.locator("canvas").elementHandle();
  for (let index = 0; index < 3; index++) {
    await expect(
      page.locator(`#jspsych-dynamic-frame-${index}-stimulus`),
    ).toBeVisible();
    await expect
      .poll(async () => (await gpuInventory(page))[0].textures)
      .toBe(2);
    const inventory = await gpuInventory(page);
    expect(inventory).toHaveLength(1);
    expect(inventory[0].losses).toBe(0);
    expect(inventory[0].lost).toBe(false);
    expect(
      await surface
        .locator("canvas")
        .evaluate((canvas, previous) => canvas === previous, original),
    ).toBe(true);
  }
  for (let index = 3; index < 5; index++) {
    await expect(
      page.locator(`#jspsych-dynamic-frame-${index}-stimulus`),
    ).toBeVisible();
    await expect
      .poll(async () =>
        (await gpuInventory(page)).filter((entry) => !entry.lost),
      )
      .toHaveLength(1);
    await expect(page.locator("#jspsych-dynamic-visual-bridge")).toHaveCount(0);
    // The button is at y = 80% of the viewport, below the image.
    const bounds = await page
      .locator("#jspsych-dynamic-plugin-container")
      .boundingBox();
    if (bounds)
      await page.mouse.click(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height * 0.8,
      );
  }
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await gpuInventory(page)).every((entry) => entry.lost))
    .toBe(true);
  const finalInventory = await gpuInventory(page);
  expect(finalInventory).toHaveLength(3);
  for (const entry of finalInventory) {
    expect(entry).toMatchObject({
      textures: 0,
      buffers: 0,
      programs: 0,
      shaders: 0,
      losses: 1,
    });
    expect(entry.draws).toBeGreaterThan(0);
  }
  expect(
    await original!.evaluate((canvas: HTMLCanvasElement) => [
      canvas.width,
      canvas.height,
      canvas.isConnected,
    ]),
  ).toEqual([0, 0, false]);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  const dynamicRows = session.data.filter((row) =>
    Array.from({ length: 5 }, (_, index) =>
      String(author.id(`frame-${index}`)),
    ).includes(String(row.builder_id)),
  );
  expect(dynamicRows.map((row) => String(row.builder_id))).toEqual(
    Array.from({ length: 5 }, (_, index) =>
      String(author.id(`frame-${index}`)),
    ),
  );
  for (const row of dynamicRows) {
    expect(JSON.parse(String(row.stimulus_timing))).toHaveLength(1);
    expect(row.render_backend).toBe("webgl");
    expect(row.webgl_context_lost_count).toBe(0);
  }
  for (const row of dynamicRows.slice(0, 3)) {
    expect(Math.abs(Number(row.actual_trial_duration) - 1200)).toBeLessThan(70);
  }
  await runtime.assertNoRuntimeFailures();
});
