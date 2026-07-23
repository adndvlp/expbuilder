import type { Locator } from "@playwright/test";
import { expect, test } from "../fixtures/test.fixture";

type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

const timeline = [
  { id: "first", type: "trial", name: "First" },
  { id: "second", type: "trial", name: "Second" },
  { id: "third", type: "trial", name: "Third" },
];

async function readViewport(viewport: Locator): Promise<Viewport> {
  return viewport.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.m41, y: matrix.m42, zoom: matrix.a };
  });
}

test("supports pinch zoom but ignores double-click zoom", async ({ page }) => {
  await page.route("**/api/trials-metadata/exp-navigation", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timeline }),
    }),
  );
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/#/home/experiment/exp-navigation/builder");

  const canvas = page.locator(".canvas-container");
  const pane = canvas.locator(".react-flow__pane");
  const viewport = canvas.locator(".react-flow__viewport");
  await expect(canvas.getByText("Third", { exact: true })).toBeVisible();

  const paneBox = await pane.boundingBox();
  expect(paneBox).not.toBeNull();
  const gesturePoint = {
    x: paneBox!.x + paneBox!.width - 80,
    y: paneBox!.y + paneBox!.height - 80,
  };
  await page.mouse.move(gesturePoint.x, gesturePoint.y);

  const beforeScroll = await readViewport(viewport);
  await page.mouse.wheel(120, 80);
  await page.waitForTimeout(100);
  const afterScroll = await readViewport(viewport);
  expect(afterScroll.x).not.toBeCloseTo(beforeScroll.x, 2);
  expect(afterScroll.y).not.toBeCloseTo(beforeScroll.y, 2);
  expect(afterScroll.zoom).toBeCloseTo(beforeScroll.zoom, 4);

  await page.mouse.move(gesturePoint.x, gesturePoint.y);
  await page.mouse.down();
  await page.mouse.move(gesturePoint.x - 120, gesturePoint.y - 80, {
    steps: 5,
  });
  await page.mouse.up();
  const afterDrag = await readViewport(viewport);
  expect(afterDrag.x).not.toBeCloseTo(afterScroll.x, 2);
  expect(afterDrag.y).not.toBeCloseTo(afterScroll.y, 2);
  expect(afterDrag.zoom).toBeCloseTo(afterScroll.zoom, 4);

  await page.mouse.dblclick(gesturePoint.x, gesturePoint.y);
  await page.waitForTimeout(100);
  const afterDoubleClick = await readViewport(viewport);
  expect(afterDoubleClick.zoom).toBeCloseTo(afterDrag.zoom, 4);

  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -80);
  await page.keyboard.up("Control");
  await page.waitForTimeout(100);
  const afterPinch = await readViewport(viewport);
  expect(afterPinch.zoom).toBeGreaterThan(afterDoubleClick.zoom);
});
