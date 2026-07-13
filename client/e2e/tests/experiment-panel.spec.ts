import { test, expect } from "../fixtures/test.fixture";
import { ExperimentPanelPage } from "../pages/ExperimentPanelPage";

test.describe("Experiment Panel Page", () => {
  let panel: ExperimentPanelPage;

  test.beforeEach(async ({ page }) => {
    panel = new ExperimentPanelPage(page);
    await panel.goto("exp-001");
  });

  test("displays the heading", async () => {
    await expect(panel.heading).toBeVisible();
  });

  test("displays experiment name", async ({ page }) => {
    await expect(page.getByText(/Test Experiment/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("displays experiment ID", async () => {
    await expect(panel.experimentId).toBeVisible();
    await expect(panel.experimentId).toContainText("exp-001");
  });

  test("has home and builder navigation buttons", async () => {
    await expect(panel.homeButton).toBeVisible();
    await expect(panel.builderButton).toBeVisible();
  });

  test("navigates to home", async ({ page }) => {
    await panel.homeButton.click();
    await page.waitForURL("**/#/home**", { timeout: 5000 });
  });

  test("navigates to builder", async ({ page }) => {
    await panel.builderButton.click();
    await page.waitForURL("**/#/home/experiment/exp-001/builder**", {
      timeout: 5000,
    });
  });

  test("has four tabs", async () => {
    await expect(panel.previewTab).toBeVisible();
    await expect(panel.localTab).toBeVisible();
    await expect(panel.onlineTab).toBeVisible();
    await expect(panel.settingsTab).toBeVisible();
  });

  test("switches to Preview Results tab", async () => {
    await panel.previewTab.click();
    const bg = await panel.previewTab.evaluate(
      (el) => window.getComputedStyle(el).background,
    );
    expect(bg).toContain("linear-gradient");
  });

  test("switches to Online Experiments tab", async () => {
    await panel.onlineTab.click();
    const bg = await panel.onlineTab.evaluate(
      (el) => window.getComputedStyle(el).background,
    );
    expect(bg).toContain("linear-gradient");
  });

  test("switches to Settings tab", async () => {
    await panel.settingsTab.click();
    const bg = await panel.settingsTab.evaluate(
      (el) => window.getComputedStyle(el).background,
    );
    expect(bg).toContain("linear-gradient");
  });

  test("handles navigation to any experiment panel", async () => {
    await panel.goto("exp-999");
    await expect(panel.experimentId).toContainText("exp-999");
  });
});
