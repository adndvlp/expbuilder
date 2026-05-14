import type { Page, Locator } from "@playwright/test";

export class LandingPage {
  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole("heading", { name: /Welcome to Builder/i });
  }

  get getStartedButton(): Locator {
    return this.page.getByRole("link", { name: /Get Started/i });
  }

  get footer(): Locator {
    return this.page.locator("footer");
  }

  get uNamLogo(): Locator {
    return this.page.getByAltText("UNAM");
  }

  async goto() {
    await this.page.goto("/#");
  }
}
