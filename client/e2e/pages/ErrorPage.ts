import type { Page, Locator } from "@playwright/test";

export class ErrorPage {
  constructor(readonly page: Page) {}

  get code404(): Locator {
    return this.page.getByText("404");
  }

  get pageNotFoundHeading(): Locator {
    return this.page.getByRole("heading", { name: /Page not found/i });
  }

  get backToHomeLink(): Locator {
    return this.page.getByRole("link", { name: /Back to home/i });
  }

  get errorMessage(): Locator {
    return this.page.getByText(/An unexpected error occurred/i);
  }

  async gotoInvalidRoute() {
    await this.page.goto("/#/this-route-does-not-exist");
  }
}
