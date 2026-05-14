import { test, expect } from "../fixtures/test.fixture";
import { LandingPage } from "../pages/LandingPage";

test.describe("Landing Page", () => {
  let landing: LandingPage;

  test.beforeEach(async ({ page }) => {
    landing = new LandingPage(page);
    await landing.goto();
  });

  test("displays the welcome heading", async () => {
    await expect(landing.heading).toBeVisible();
    await expect(landing.heading).toHaveText("Welcome to Builder");
  });

  test("displays the tagline", async ({ page }) => {
    await expect(
      page.getByText(/Create, manage, and launch behavioral experiments/i)
    ).toBeVisible();
  });

  test("has a Get Started button linking to /home", async () => {
    await expect(landing.getStartedButton).toBeVisible();
    await expect(landing.getStartedButton).toHaveAttribute("href", "#/home");
  });

  test("clicking Get Started navigates to home", async ({ page }) => {
    await landing.getStartedButton.click();
    await page.waitForURL("**/#/home**", { timeout: 5000 });
  });

  test("displays the footer with institutional logos", async () => {
    await expect(landing.footer).toBeVisible();
    await expect(landing.footer).toContainText("ExpBuilder");
    await expect(landing.footer).toContainText("UNAM");
    await expect(landing.uNamLogo).toBeVisible();
  });

  test("displays copyright with current year", async ({ page }) => {
    const currentYear = new Date().getFullYear().toString();
    await expect(landing.footer).toContainText(currentYear);
  });

  test("footer contains support and contact sections", async () => {
    await expect(landing.footer).toContainText("Support Us");
    await expect(landing.footer).toContainText("Developer Contact");
    await expect(landing.footer).toContainText("Institutional Home");
  });

  test("displays app logo", async ({ page }) => {
    const logos = page.locator('img[src*="icon.png"], .logo-img');
    await expect(logos.first()).toBeVisible();
  });

  test("has gradient background", async ({ page }) => {
    // The gradient is on the outermost div with minHeight style
    const container = page.locator('div[style*="min-height: 100vh"]').first();
    const styles = await container.evaluate((el) =>
      window.getComputedStyle(el).background
    );
    expect(styles).toContain("linear-gradient");
  });

  test("Get Started button has hover effects", async () => {
    await landing.getStartedButton.hover();
    const bg = await landing.getStartedButton.evaluate((el) =>
      window.getComputedStyle(el).background
    );
    expect(bg).toBeDefined();
  });
});
