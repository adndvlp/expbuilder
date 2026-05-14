import type { Page, Locator } from "@playwright/test";

export class DocsPage {
  constructor(readonly page: Page) {}

  get title(): Locator {
    return this.page.getByText(/Builder Documentation/i);
  }

  get sidebarToggle(): Locator {
    return this.page.getByTitle("Toggle sidebar");
  }

  get backButton(): Locator {
    return this.page.getByRole("button", { name: /Dashboard/i });
  }

  get sidebar(): Locator {
    return this.page.locator(".docs-sidebar");
  }

  get searchInput(): Locator {
    return this.page.locator(".docs-search");
  }

  get navItems(): Locator {
    return this.page.locator(".docs-nav-item");
  }

  get contentArea(): Locator {
    return this.page.locator(".docs-content");
  }

  get noResultsMessage(): Locator {
    return this.page.getByText("No results");
  }

  async goto() {
    await this.page.goto("/#/docs");
  }

  async search(term: string) {
    await this.searchInput.fill(term);
  }

  async selectSection(index: number) {
    await this.navItems.nth(index).click();
  }
}
