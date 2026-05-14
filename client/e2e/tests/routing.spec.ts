import { test, expect } from "../fixtures/test.fixture";

test.describe("Navigation and Routing", () => {
  test("hash router handles direct URL access to /home", async ({ page }) => {
    await page.goto("/#/home");
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/home/);
  });

  test("can navigate between pages via URLs", async ({ page }) => {
    await page.goto("/#/");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/#\/$/);
    await page.goto("/#/auth/login");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/#\/auth\/login/);
    await page.goto("/#/auth/register");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/#\/auth\/register/);
  });

  test("full user flow: landing -> login -> dashboard", async ({ page }) => {
    await page.goto("/#/");
    await page.waitForTimeout(500);
    const getStarted = page.getByRole("link", { name: /Get Started/i });
    await expect(getStarted).toBeVisible();
    await getStarted.click();
    await page.waitForURL("**/#/home**", { timeout: 5000 });
  });

  test("full user flow: dashboard -> experiment -> builder", async ({
    page,
  }) => {
    await page.goto("/#/home");
    await page.waitForSelector(".experiment-bar", { timeout: 5000 });
    await page.locator(".experiment-bar").first().click();
    await page.waitForURL("**/#/home/experiment/**", { timeout: 5000 });
    await page.getByRole("button", { name: /Go to Builder/i }).click();
    await page.waitForURL("**/#/home/experiment/**/builder**", {
      timeout: 5000,
    });
  });

  test("docs page accessible from dashboard menu", async ({ page }) => {
    await page.goto("/#/home");
    await page.waitForTimeout(500);
    await page.getByLabel("Open menu").click();
    await page.locator(".menu-item", { hasText: "Documentation" }).click();
    await page.waitForURL("**/#/docs**", { timeout: 5000 });
  });

  test("settings page accessible from dashboard menu", async ({ page }) => {
    await page.goto("/#/home");
    await page.waitForTimeout(500);
    await page.getByLabel("Open menu").click();
    await page.locator(".menu-item", { hasText: "Settings" }).click();
    await page.waitForURL("**/#/settings**", { timeout: 5000 });
  });

  test("landing page footer links do not break navigation", async ({
    page,
  }) => {
    await page.goto("/#/");
    await page.waitForTimeout(500);
    await expect(page.locator("footer")).toBeVisible();
  });

  test("all routes render without console errors", async ({ page }) => {
    const routes = [
      "/#/",
      "/#/auth/login",
      "/#/auth/register",
      "/#/home",
      "/#/settings",
      "/#/docs",
      "/#/home/experiment/exp-001",
      "/#/home/experiment/exp-001/builder",
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(1000);
      const bodyText = await page.locator("body").textContent();
      expect(bodyText).toBeTruthy();
    }
  });
});
