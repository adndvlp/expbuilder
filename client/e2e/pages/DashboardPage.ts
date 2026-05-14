import type { Page, Locator } from "@playwright/test";

export class DashboardPage {
  constructor(readonly page: Page) {}

  get createButton(): Locator {
    return this.page.getByRole("button", { name: /Create experiment/i });
  }

  get menuIcon(): Locator {
    return this.page.getByLabel("Open menu");
  }

  get menuDropdown(): Locator {
    return this.page.locator(".menu-dropdown");
  }

  get settingsMenuItem(): Locator {
    return this.page.locator(".menu-item", { hasText: "Settings" });
  }

  get docsMenuItem(): Locator {
    return this.page.locator(".menu-item", { hasText: "Documentation" });
  }

  get experimentBars(): Locator {
    return this.page.locator(".experiment-bar");
  }

  get promptOverlay(): Locator {
    return this.page.locator(".prompt-modal-overlay");
  }

  get promptInput(): Locator {
    return this.page.locator(".prompt-modal-input");
  }

  get promptConfirmButton(): Locator {
    return this.page.locator(".prompt-modal-btn.confirm");
  }

  get promptCancelButton(): Locator {
    return this.page.locator(".prompt-modal-btn.cancel");
  }

  async goto() {
    await this.page.goto("/#/home");
  }

  async openMenu() {
    await this.menuIcon.click();
  }

  async createExperiment(name: string) {
    await this.createButton.click();
    await this.promptInput.fill(name);
    await this.promptConfirmButton.click();
  }

  async deleteExperiment(index: number) {
    const bars = this.experimentBars;
    const deleteBtn = bars.nth(index).getByRole("button", { name: /Delete/i });
    await deleteBtn.click();
  }

  async selectExperiment(index: number) {
    await this.experimentBars.nth(index).click();
  }
}
