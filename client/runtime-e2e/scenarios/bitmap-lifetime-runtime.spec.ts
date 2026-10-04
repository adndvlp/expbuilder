import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { typed } from "../support/responsiveScene";
import { loadPersistedSession, runtimeApiBaseUrl } from "../support/session";
import {
  bitmapInventory,
  installBitmapLifetimeProbe,
} from "../support/bitmapLifetimeProbe";

test.use({ video: "off" });

for (const standardTail of [true, false]) {
  test(`bounds the protected bitmap window and releases it ${standardTail ? "before a standard plugin" : "when the experiment finishes"}`, async ({
    page,
  }) => {
    const images = await page.evaluate(() =>
      Array.from({ length: 8 }, (_, index) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const context = canvas.getContext("2d")!;
        context.fillStyle = `rgb(${index * 30}, 100, 100)`;
        context.fillRect(0, 0, 32, 32);
        return canvas.toDataURL();
      }),
    );
    const author = new ScenarioAuthor(runtimeApiBaseUrl);
    await author.createExperiment(`bitmap-lifetime-${Date.now()}`);
    const order = [0, 0, 1, 2, 3, 4, 5, 6, 7, 0];
    for (const [index, source] of order.entries()) {
      const name = `bitmap-${index}`;
      await author.createTrial(name);
      await author.configureDynamicTrial(name, {
        components: typed([
          {
            type: "ImageComponent",
            name: typed(name),
            stimulus: typed(images[source]),
            coordinates: { x: 0, y: 0 },
            width: 10,
            height: 10,
          },
        ]),
        trial_duration: typed(700),
        dynamic_csv_diagnostics: typed("stimulus"),
        prefetch_trial_count: typed(3),
      });
    }
    if (standardTail) {
      await author.createTrial("tail");
      await author.configureButtonTrial("tail");
    }
    const artifact = await author.compileAndBuild();
    const runtime = new RuntimeObserver(page);
    await installBitmapLifetimeProbe(page);
    await page.goto(artifact.experimentUrl);
    let repeatedSourceId = 0;
    for (const [index] of order.entries()) {
      await expect(
        page.locator(`#jspsych-dynamic-bitmap-${index}-stimulus`),
      ).toBeVisible();
      await expect
        .poll(
          async () =>
            (await bitmapInventory(page)).filter((entry) => !entry.closed)
              .length,
        )
        .toBeLessThanOrEqual(4);
      const inventory = await bitmapInventory(page);
      const live = inventory.filter((entry) => !entry.closed);
      // One current trial and the existing three-trial prefetch window.
      expect(live.length).toBeLessThanOrEqual(4);
      expect(live.length).toBeGreaterThan(0);
      if (index === 0) repeatedSourceId = live[0].id;
      if (index === 1)
        expect(live.some((entry) => entry.id === repeatedSourceId)).toBe(true);
    }
    if (standardTail) {
      await expect(
        page.getByRole("button", { name: "Continue", exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText("Experiment complete. Thank you!"),
      ).toBeVisible();
    }
    await expect
      .poll(async () =>
        (await bitmapInventory(page)).filter((entry) => !entry.closed),
      )
      .toHaveLength(0);
    const retired = await bitmapInventory(page);
    expect(retired.length).toBeGreaterThanOrEqual(8);
    for (const entry of retired)
      expect(entry).toMatchObject({ closed: true, width: 0, height: 0 });
    if (standardTail)
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByText("Experiment complete. Thank you!"),
    ).toBeVisible();
    const { session } = await loadPersistedSession(
      author.experimentId,
      await runtime.sessionId(),
    );
    const ids = order.map((_, index) => String(author.id(`bitmap-${index}`)));
    const rows = session.data.filter((row) =>
      ids.includes(String(row.builder_id)),
    );
    expect(rows.map((row) => String(row.builder_id))).toEqual(ids);
    for (const row of rows) {
      expect(JSON.parse(String(row.stimulus_timing))).toHaveLength(1);
      expect(Math.abs(Number(row.actual_trial_duration) - 700)).toBeLessThan(
        70,
      );
      expect(row.webgl_context_lost_count).toBe(0);
    }
    await runtime.assertNoRuntimeFailures();
  });
}
