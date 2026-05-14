import { test, expect } from "../fixtures/test.fixture";

test.describe("OAuth Callback Pages", () => {
  test("Google Drive callback page body renders", async ({ page }) => {
    await page.goto("/#/google-drive-callback?code=test-code&state=test-state");
    await page.waitForTimeout(1000);
    const body = page.locator("body");
    await expect(body).toBeAttached();
  });

  test("Dropbox callback page body renders", async ({ page }) => {
    await page.goto("/#/dropbox-callback?code=test-code&state=test-state");
    await page.waitForTimeout(1000);
    const body = page.locator("body");
    await expect(body).toBeAttached();
  });

  test("GitHub callback page body renders", async ({ page }) => {
    await page.goto("/#/github-callback?code=test-code&state=test-state");
    await page.waitForTimeout(1000);
    const body = page.locator("body");
    await expect(body).toBeAttached();
  });

  test("OSF callback page body renders", async ({ page }) => {
    await page.goto("/#/oauth/osf/callback?code=test-code&state=test-state");
    await page.waitForTimeout(1000);
    const body = page.locator("body");
    await expect(body).toBeAttached();
  });
});
