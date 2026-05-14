import type { Page, Locator } from "@playwright/test";

export class SettingsPage {
  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole("heading", { name: /Settings/i });
  }

  get backButton(): Locator {
    return this.page.getByRole("button", { name: "←" });
  }

  get importButton(): Locator {
    return this.page.getByRole("button", { name: /Choose .zip file/i });
  }

  get exportAllButton(): Locator {
    return this.page.getByRole("button", { name: /Export all/i });
  }

  get exportSelectedButton(): Locator {
    return this.page.getByRole("button", { name: /Export selected/i });
  }

  get logoutButton(): Locator {
    return this.page.getByRole("button", { name: /Logout/ });
  }

  get deleteAccountButton(): Locator {
    return this.page.getByRole("button", { name: /Delete Account/i });
  }

  get notification(): Locator {
    return this.page.locator(".notification");
  }

  get accountInfoSection(): Locator {
    return this.page.locator(".account-info");
  }

  get integrationTokens(): Locator {
    return this.page.locator(".tokens-list");
  }

  get googleDriveToken(): Locator {
    return this.page.locator(".google-drive-token");
  }

  get changePasswordSection(): Locator {
    return this.page.getByText("Change Password");
  }

  get noAccountOverlay(): Locator {
    return this.page.getByText(/You need an account/i);
  }

  get goToLoginButton(): Locator {
    return this.page.getByRole("button", { name: /Go to Login/i });
  }

  async goto() {
    await this.page.goto("/#/settings");
  }
}
