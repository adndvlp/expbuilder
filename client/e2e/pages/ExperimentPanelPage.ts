import type { Page, Locator } from "@playwright/test";

export class ExperimentPanelPage {
  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole("heading", { name: /Experiment Panel/i });
  }

  get experimentName(): Locator {
    return this.page.getByText(/Experiment Name:/i);
  }

  get experimentId(): Locator {
    return this.page.getByText(/Experiment ID:/i);
  }

  get homeButton(): Locator {
    return this.page.getByRole("button", { name: /Go to Home/i });
  }

  get builderButton(): Locator {
    return this.page.getByRole("button", { name: /Go to Builder/i });
  }

  get previewTab(): Locator {
    return this.page.getByRole("button", { name: /Preview Results/i });
  }

  get localTab(): Locator {
    return this.page.getByRole("button", { name: /Local Experiments/i });
  }

  get onlineTab(): Locator {
    return this.page.getByRole("button", { name: /Online Experiments/i });
  }

  get settingsTab(): Locator {
    return this.page.getByRole("button", { name: /Settings/ }).first();
  }

  async goto(experimentId: string) {
    await this.page.goto(`/#/home/experiment/${experimentId}`);
  }
}
