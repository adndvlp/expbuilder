import type { Page, Locator } from "@playwright/test";

export class ExperimentBuilderPage {
  constructor(readonly page: Page) {}

  get backButton(): Locator {
    return this.page.locator('button:has-text("←")').first();
  }

  get timelineContainer(): Locator {
    return this.page.locator(".timeline-container");
  }

  get timelineHeader(): Locator {
    return this.page.getByText("Timeline", { exact: true });
  }

  get canvasContainer(): Locator {
    return this.page.locator(".canvas-container");
  }

  get configPanel(): Locator {
    return this.page.locator(".config-panel-container");
  }

  get devModeSwitch(): Locator {
    return this.page.locator("#devMode");
  }

  get saveModeSwitch(): Locator {
    return this.page.locator("#saveMode");
  }

  get codeEditor(): Locator {
    return this.page.locator(".monaco-editor");
  }

  async goto(experimentId: string) {
    await this.page.goto(`/#/home/experiment/${experimentId}/builder`);
  }

  async toggleDevMode() {
    await this.devModeSwitch.click({ force: true });
  }

  async toggleSaveMode() {
    await this.saveModeSwitch.click({ force: true });
  }
}
