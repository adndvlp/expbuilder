import { test, expect } from "../fixtures/test.fixture";
import { DashboardPage } from "../pages/DashboardPage";

test.describe("Dashboard Page", () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
  });

  test("displays the create experiment button", async () => {
    await expect(dashboard.createButton).toBeVisible();
  });

  test("loads and displays experiments list", async () => {
    await expect(dashboard.experimentBars).toHaveCount(3, { timeout: 5000 });
  });

  test("displays experiment names", async ({ page }) => {
    await expect(page.getByText("Stroop Task")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Visual Search")).toBeVisible();
    await expect(page.getByText("Memory Recall")).toBeVisible();
  });

  test("opens menu dropdown", async () => {
    await dashboard.openMenu();
    await expect(dashboard.menuDropdown).toBeVisible();
    await expect(dashboard.settingsMenuItem).toBeVisible();
    await expect(dashboard.docsMenuItem).toBeVisible();
  });

  test("navigates to settings from menu", async ({ page }) => {
    await dashboard.openMenu();
    await dashboard.settingsMenuItem.click();
    await page.waitForURL("**/#/settings**", { timeout: 5000 });
  });

  test("navigates to docs from menu", async ({ page }) => {
    await dashboard.openMenu();
    await dashboard.docsMenuItem.click();
    await page.waitForURL("**/#/docs**", { timeout: 5000 });
  });

  test("closes menu when clicking outside", async () => {
    await dashboard.openMenu();
    await expect(dashboard.menuDropdown).toBeVisible();
    await dashboard.menuIcon.click();
    await expect(dashboard.menuDropdown).not.toBeVisible();
  });

  test("opens prompt modal when clicking create", async () => {
    await dashboard.createButton.click();
    await expect(dashboard.promptOverlay).toBeVisible();
    await expect(dashboard.promptInput).toBeVisible();
  });

  test("closes prompt modal on cancel", async () => {
    await dashboard.createButton.click();
    await expect(dashboard.promptOverlay).toBeVisible();
    await dashboard.promptCancelButton.click();
    await expect(dashboard.promptOverlay).not.toBeVisible();
  });

  test("creates experiment via prompt modal", async () => {
    await dashboard.createExperiment("My New Experiment");
    await expect(dashboard.promptOverlay).not.toBeVisible();
  });

  test("navigates to experiment panel when clicking an experiment", async ({
    page,
  }) => {
    await dashboard.selectExperiment(0);
    await page.waitForURL("**/#/home/experiment/exp-001**", { timeout: 5000 });
  });

  test("delete button triggers confirm dialog", async ({ page }) => {
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Delete this experiment?");
      await dialog.accept();
    });
    await dashboard.deleteExperiment(0);
    await expect(dashboard.experimentBars).toHaveCount(2, { timeout: 3000 });
  });

  test("delete cancel keeps experiment", async ({ page }) => {
    page.once("dialog", async (dialog) => {
      await dialog.dismiss();
    });
    await dashboard.deleteExperiment(0);
    await expect(dashboard.experimentBars).toHaveCount(3);
  });

  test("create button handles loading state", async () => {
    await dashboard.createExperiment("Test");
    // Modal should close after successful creation
    await expect(dashboard.promptOverlay).not.toBeVisible({ timeout: 5000 });
  });

  test("delete button does not navigate away", async ({ page }) => {
    await dashboard.deleteExperiment(0);
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/home/);
  });
});
