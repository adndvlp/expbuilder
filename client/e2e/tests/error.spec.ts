import { test, expect } from "../fixtures/test.fixture";
import { ErrorPage } from "../pages/ErrorPage";

test.describe("Error / 404 Page", () => {
  let errorPage: ErrorPage;

  test.beforeEach(async ({ page }) => {
    errorPage = new ErrorPage(page);
  });

  test("displays 404 for invalid routes", async () => {
    await errorPage.gotoInvalidRoute();
    await expect(errorPage.code404).toBeVisible();
  });

  test("displays page not found heading", async () => {
    await errorPage.gotoInvalidRoute();
    await expect(errorPage.pageNotFoundHeading).toBeVisible();
  });

  test("displays descriptive message", async ({ page }) => {
    await errorPage.gotoInvalidRoute();
    await expect(
      page.getByText(/does not exist or was moved/i),
    ).toBeVisible();
  });

  test("has a back to home link", async () => {
    await errorPage.gotoInvalidRoute();
    await expect(errorPage.backToHomeLink).toBeVisible();
  });

  test("back to home link navigates to landing page", async ({ page }) => {
    await errorPage.gotoInvalidRoute();
    await errorPage.backToHomeLink.click();
    await page.waitForURL("**/#/", { timeout: 5000 });
  });

  test("displays error SVG icon", async ({ page }) => {
    await errorPage.gotoInvalidRoute();
    const svg = page.locator("svg").first();
    await expect(svg).toBeVisible();
  });

  test("supports nested invalid routes", async ({ page }) => {
    await page.goto("/#/foo/bar/baz/nonexistent");
    await expect(errorPage.code404).toBeVisible();
  });

  test("supports routes with query params", async ({ page }) => {
    await page.goto("/#/invalid?foo=bar&baz=qux");
    await expect(errorPage.code404).toBeVisible();
  });
});
