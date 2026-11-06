import { expect, test } from "@playwright/test";

type Recorded = {
  saves: {
    components: {
      value: {
        type: string;
        width: number;
        coordinates: { x: number; y: number };
      }[];
    };
  }[];
  autosaves: unknown[];
  reopen(): void;
};

test("real Konva and HTML keep one composition, edit at mobile scale and reopen without geometry drift", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        name: "ImageComponent",
        version: "1",
        parameters: {},
        files: [],
      }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/e2e/harness/proportional-designer.html");
  const picture = page.locator(
    "[data-html-scene-overlay] .dynamic-image-component",
  );
  const text = page.locator(
    "[data-html-scene-overlay] .dynamic-text-component",
  );
  await expect(picture).toBeVisible();
  for (const title of [
    "Mobile — 375 × 725",
    "Desktop — 2560 × 1450",
    "Tablet — 768 × 725",
  ]) {
    await page.getByTitle(title, { exact: true }).click();
    await expect
      .poll(async () => {
        const p = (await picture.boundingBox())!,
          t = (await text.boundingBox())!;
        return (p.y + p.height / 2 - (t.y + t.height / 2)) / p.width;
      })
      .toBeCloseTo(435 / 512, 2);
  }
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { designerRecorded: Recorded }).designerRecorded
          .autosaves.length,
    ),
  ).toBe(0);
  await page.getByTitle("Mobile — 375 × 725", { exact: true }).click();
  await expect
    .poll(async () => {
      const frame = (await page
        .locator("[data-designer-viewport]")
        .boundingBox())!;
      return frame.width / frame.height;
    })
    .toBeCloseTo(375 / 725, 3);
  // Konva batches the hit canvas redraw after React updates the preview frame.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  const center = (await picture.boundingBox())!;
  await page.mouse.click(
    center.x + center.width / 2,
    center.y + center.height / 2,
  );
  await expect(
    picture.locator("xpath=ancestor::*[@data-scene-node-id]"),
  ).toHaveCSS("outline-style", "solid");
  const before = (await picture.boundingBox())!;
  await page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    before.x + before.width / 2 + 25,
    before.y + before.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { designerRecorded: Recorded }).designerRecorded
            .autosaves.length,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Save Trial", exact: true }).click();
  const saved = await page.evaluate(
    () =>
      (
        window as unknown as { designerRecorded: Recorded }
      ).designerRecorded.saves.at(-1)!,
  );
  const image = saved.components.value.find(
    (component) => component.type === "ImageComponent",
  )!;
  expect(image.width).toBe(20);
  expect(image.coordinates.x).toBeGreaterThan(0);
  const moved = (await picture.boundingBox())!;
  expect(image.coordinates.x).toBeCloseTo(
    ((moved.x - before.x) * 40) / before.width,
    1,
  );
  await page.evaluate(() =>
    (
      window as unknown as { designerRecorded: Recorded }
    ).designerRecorded.reopen(),
  );
  await expect(picture).toBeVisible();
  await page.getByRole("button", { name: "Save Trial", exact: true }).click();
  const reopened = await page.evaluate(
    () =>
      (
        window as unknown as { designerRecorded: Recorded }
      ).designerRecorded.saves.at(-1)!,
  );
  expect(
    reopened.components.value.find(
      (component) => component.type === "ImageComponent",
    ),
  ).toEqual(image);
  expect(errors).toEqual([]);
});
