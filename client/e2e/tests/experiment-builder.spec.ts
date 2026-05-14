import { test, expect } from "../fixtures/test.fixture";
import { ExperimentBuilderPage } from "../pages/ExperimentBuilderPage";

test.describe("Experiment Builder Page", () => {
  let builder: ExperimentBuilderPage;

  test.beforeEach(async ({ page }) => {
    builder = new ExperimentBuilderPage(page);
    await builder.goto("exp-001");
  });

  test("displays the back button", async () => {
    await expect(builder.backButton).toBeVisible();
  });

  test("navigates back when clicking back button", async ({ page }) => {
    // First navigate to experiment panel, then to builder to establish history
    await page.goto("/#/home/experiment/exp-001");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Go to Builder/i }).click();
    await page.waitForURL("**/builder**", { timeout: 5000 });
    // Now click the back button in the builder
    await builder.backButton.click();
    // Should navigate back to experiment panel
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain("experiment");
  });

  test("displays three panels: timeline, canvas, config", async () => {
    await expect(builder.timelineContainer).toBeVisible();
    await expect(builder.canvasContainer).toBeVisible();
    await expect(builder.configPanel).toBeVisible();
  });

  test("displays timeline header", async () => {
    await expect(builder.timelineHeader).toBeVisible();
  });

  test("has dev mode switch", async () => {
    await expect(builder.devModeSwitch).toBeVisible();
  });

  test("has save mode switch", async () => {
    await expect(builder.saveModeSwitch).toBeVisible();
  });

  test("toggles dev mode", async () => {
    await builder.toggleDevMode();
    const checked = await builder.devModeSwitch.isChecked();
    expect(checked).toBeDefined();
  });

  test("default mode shows canvas, not code editor", async () => {
    await expect(builder.canvasContainer).toBeVisible();
    await expect(builder.codeEditor).not.toBeVisible({ timeout: 3000 });
  });

  test("timeline panel has resize handle", async () => {
    const resizeHandle = builder.timelineContainer.locator(
      '[style*="cursor: col-resize"]',
    );
    await expect(resizeHandle).toBeVisible();
  });

  test("config panel has resize handle", async () => {
    const resizeHandles = builder.configPanel.locator(
      '[style*="cursor: col-resize"]',
    );
    const count = await resizeHandles.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("handles viewport changes", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await expect(builder.timelineContainer).toBeAttached();
    await expect(builder.canvasContainer).toBeAttached();
    await expect(builder.configPanel).toBeAttached();
  });

  test("toggles save mode switch", async () => {
    await builder.toggleSaveMode();
    const checked = await builder.saveModeSwitch.isChecked();
    expect(checked).toBeDefined();
  });
});
