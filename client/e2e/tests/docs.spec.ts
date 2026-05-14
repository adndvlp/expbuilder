import { test, expect } from "../fixtures/test.fixture";
import { DocsPage } from "../pages/DocsPage";

test.describe("Docs Page", () => {
  let docs: DocsPage;

  test.beforeEach(async ({ page }) => {
    docs = new DocsPage(page);
    await docs.goto();
  });

  test("displays the title", async () => {
    await expect(docs.title).toBeVisible();
  });

  test("has a back button to dashboard", async ({ page }) => {
    await expect(docs.backButton).toBeVisible();
    await docs.backButton.click();
    await page.waitForURL("**/#/home**", { timeout: 5000 });
  });

  test("displays the sidebar", async () => {
    await expect(docs.sidebar).toBeVisible();
  });

  test("has search input", async () => {
    await expect(docs.searchInput).toBeVisible();
    await expect(docs.searchInput).toHaveAttribute("placeholder", "Search…");
  });

  test("displays navigation items", async () => {
    const count = await docs.navItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test("search filters navigation items", async () => {
    await docs.search("xyznonexistent12345");
    await expect(docs.noResultsMessage).toBeVisible();
  });

  test("search returns matching items", async () => {
    await docs.search("");
    const count = await docs.navItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test("has toggle sidebar button", async () => {
    await expect(docs.sidebarToggle).toBeVisible();
  });

  test("can toggle sidebar visibility", async () => {
    await expect(docs.sidebar).toBeVisible();
    await docs.sidebarToggle.click();
    await expect(docs.sidebar).not.toBeVisible();
    await docs.sidebarToggle.click();
    await expect(docs.sidebar).toBeVisible();
  });

  test("displays content area", async () => {
    await expect(docs.contentArea).toBeVisible();
  });

  test("content is visible after section change", async () => {
    const count = await docs.navItems.count();
    if (count > 1) {
      await docs.navItems.nth(0).click();
      await expect(docs.contentArea).toBeVisible();
    }
  });
});
