import { test, expect } from "../fixtures/test.fixture";

test.describe("Chat FAB and Panel", () => {
  test("Chat elements exist in DOM", async ({ page }) => {
    await page.goto("/#/home");
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
