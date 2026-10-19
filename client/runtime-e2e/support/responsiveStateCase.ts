import { expect, type Page } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { loadPersistedSession, runtimeApiBaseUrl } from "./session";
import { typed } from "./responsiveScene";
import { createResponsiveVideo } from "./responsiveVideo";

export async function verifyResponsiveState(page: Page) {
  const video = await createResponsiveVideo();
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`responsive-state-${Date.now()}`);
  await author.createTrial("state");
  await author.configureDynamicTrial("state", {
    components: typed([
      {
        type: "VideoComponent",
        name: typed("video"),
        coordinates: { x: 50, y: 55 },
        stimulus: typed([video]),
        width: 12,
        height: 12,
        controls: typed(true),
        autoplay: typed(false),
      },
    ]),
    response_components: typed([
      {
        type: "SurveyComponent",
        name: typed("survey"),
        component_id: "survey",
        coordinates: { x: -50, y: -35 },
        min_width: typed("250px"),
        survey_json: typed({
          pages: [
            {
              elements: [
                {
                  type: "text",
                  name: "note",
                  title: "Your note",
                  placeholder: "Survey answer",
                },
              ],
            },
            {
              elements: [
                { type: "text", name: "second", title: "Second page" },
              ],
            },
          ],
        }),
      },
      {
        type: "SketchpadComponent",
        name: typed("sketch"),
        component_id: "sketch",
        coordinates: { x: 50, y: -35 },
        canvas_shape: typed("rectangle"),
        canvas_width: typed(160),
        canvas_height: typed(90),
        stroke_color: typed("#222222"),
        stroke_width: typed(3),
        stroke_color_palette: typed(["#222222"]),
        background_color: typed("#ffffff"),
        background_image: typed(null),
        key_to_draw: typed(null),
        prompt: typed(null),
        show_clear_button: typed(true),
        clear_button_label: typed("Clear"),
        show_undo_button: typed(true),
        undo_button_label: typed("Undo"),
      },
      {
        type: "FileUploadResponseComponent",
        name: typed("file"),
        component_id: "file",
        coordinates: { x: 0, y: 85 },
        button_label: typed("Upload note"),
        accept: typed(".txt"),
        show_preview: typed(false),
      },
    ]),
    response_ends_trial: typed(false),
    trial_duration: typed(8000),
  });
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(artifact.experimentUrl);
  await page.getByPlaceholder("Survey answer").fill("Keep survey response");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Second page", { exact: true })).toBeVisible();
  const sketch = page.locator("#sketchpad-canvas");
  const bounds = (await sketch.boundingBox())!;
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 90, bounds.y + 60, { steps: 5 });
  await page.mouse.up();
  const drawing = await sketch.evaluate((canvas: HTMLCanvasElement) =>
    canvas.toDataURL(),
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Retain this file"),
    });
  await expect(page.getByText("✓ Upload complete")).toBeVisible();
  await page.locator("video").evaluate(async (element: HTMLVideoElement) => {
    element.muted = true;
    await element.play();
  });
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  const videoHandle = await page.locator("video").elementHandle();
  const sketchHandle = await sketch.elementHandle();
  const fileHandle = await page.locator('input[type="file"]').elementHandle();
  const previousTime = await page
    .locator("video")
    .evaluate((element: HTMLVideoElement) => element.currentTime);
  for (const size of [
    { width: 1800, height: 1100 },
    { width: 650, height: 850 },
    { width: 1500, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(() =>
        page
          .locator("#jspsych-dynamic-plugin-container")
          .evaluate((element) => element.clientWidth),
      )
      .toBe(size.width);
    expect(
      await sketch.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
    ).toBe(drawing);
    expect(
      await sketch.evaluate(
        (element, original) => element === original,
        sketchHandle,
      ),
    ).toBe(true);
    expect(
      await page
        .locator('input[type="file"]')
        .evaluate((element, original) => element === original, fileHandle),
    ).toBe(true);
    expect(
      await page
        .locator('input[type="file"]')
        .evaluate((element: HTMLInputElement) => element.files![0].name),
    ).toBe("note.txt");
    expect(
      await page
        .locator("video")
        .evaluate((element, original) => element === original, videoHandle),
    ).toBe(true);
    expect(
      await page
        .locator("video")
        .evaluate((element: HTMLVideoElement) => element.paused),
    ).toBe(false);
    await expect(page.getByText("Second page", { exact: true })).toBeVisible();
  }
  expect(
    await page
      .locator("video")
      .evaluate((element: HTMLVideoElement) => element.currentTime),
  ).toBeGreaterThanOrEqual(previousTime);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByPlaceholder("Survey answer")).toHaveValue(
    "Keep survey response",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(JSON.stringify(session.data)).toContain("Keep survey response");
  expect(JSON.stringify(session.data)).toContain("note.txt");
  await runtime.assertNoRuntimeFailures();
}
