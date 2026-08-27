import type { Page } from "@playwright/test";

type RuntimeEvent = {
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
};

export class RuntimeObserver {
  readonly failures: string[] = [];

  constructor(readonly page: Page) {
    page.on("pageerror", (error) => {
      this.failures.push(`pageerror: ${error.message}`);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        this.failures.push(`console.error: ${message.text()}`);
      }
    });
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText === "net::ERR_ABORTED") return;
      this.failures.push(
        `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText}`,
      );
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        this.failures.push(
          `response: ${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });
  }

  trial(alias: string) {
    return this.page.locator(`[data-runtime-trial="${alias}"]`);
  }

  async continue() {
    await this.page.getByRole("button", { name: "Continue" }).click();
  }

  async choose(label: string) {
    await this.page.getByRole("button", { name: label }).click();
  }

  async clickDynamicCanvasCenter() {
    const container = this.page.locator("#jspsych-dynamic-plugin-container");
    const bounds = await container.boundingBox();
    if (!bounds) throw new Error("DynamicPlugin canvas is not visible");
    await this.page.mouse.click(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
  }

  async snapshot(): Promise<{ events: RuntimeEvent[]; errors: unknown[] }> {
    return this.page.evaluate(() => {
      const runtime = (window as unknown as {
        ExpBuilderRuntime?: {
          snapshot(): { events: RuntimeEvent[]; errors: unknown[] };
        };
      }).ExpBuilderRuntime;
      return runtime?.snapshot() ?? { events: [], errors: [] };
    });
  }

  async sessionId() {
    return this.page.evaluate(() =>
      String(
        (window as unknown as { JSPSYCH_SESSION_ID?: string })
          .JSPSYCH_SESSION_ID ?? "",
      ),
    );
  }

  async waitForPersistence() {
    await this.page.evaluate(async () => {
      const persistence = (window as unknown as {
        ExpBuilderPersistence?: { whenIdle(): Promise<void> };
      }).ExpBuilderPersistence;
      if (!persistence) throw new Error("Runtime persistence API is missing");
      await persistence.whenIdle();
    });
  }

  async assertNoRuntimeFailures() {
    const snapshot = await this.snapshot();
    if (this.failures.length || snapshot.errors.length) {
      throw new Error(
        `Runtime failures:\n${JSON.stringify({
          browser: this.failures,
          runtime: snapshot.errors,
        }, null, 2)}`,
      );
    }
  }
}
