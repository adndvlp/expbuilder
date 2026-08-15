import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSelectedPreviewPersistence } from "./selectedPreviewPersistence";

type PreviewWindow = Window & {
  __completePreview: () => Promise<boolean>;
  __initPreview: () => Promise<number>;
  __persistPreview: (data: unknown) => void;
};

let browser: Browser;

describe("selected preview persistence in Chromium", () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("keeps completion retryable when its first network response is lost", async () => {
    const context = await browser.newContext();
    await context.route("http://preview.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head></head><body></body></html>",
      }),
    );
    const page = await context.newPage();
    await page.goto("http://preview.test/");
    const code = buildSelectedPreviewPersistence({
      experimentID: "preview-exp",
      isSaveMode: true,
      selectionName: "Choice",
    });

    await page.evaluate((persistenceCode) => {
      let completionAttempts = 0;
      window.fetch = async (input, init) => {
        const url = String(input);
        const method = init?.method || "GET";
        if (method === "POST" && url.includes("append-result")) {
          const body = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({
            success: true,
            id: body.sessionId,
            participantNumber: 1,
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (method === "PUT") {
          const body = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({
            success: true,
            eventId: body.eventId,
            sequence: body.sequence,
            storedCount: body.sequence + 1,
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.includes("complete-session")) {
          completionAttempts += 1;
          if (completionAttempts === 1) throw new Error("response lost");
          return new Response(JSON.stringify({
            success: true,
            storedEventCount: 1,
            lastSequence: 0,
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      };

      new Function(`${persistenceCode}
        window.__initPreview = initParticipant;
        window.__persistPreview = persistPreviewResult;
        window.__completePreview = completePreviewSession;
      `)();
    }, code);

    expect(await page.evaluate(
      () => (window as PreviewWindow).__initPreview(),
    )).toBe(1);
    await page.evaluate(() => {
      (window as PreviewWindow).__persistPreview({ answer: "kept" });
    });

    const firstAttempt = await page.evaluate(async () => {
      try {
        return { completed: await (window as PreviewWindow).__completePreview() };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    });
    expect(firstAttempt).toEqual({ completed: false });
    expect(await page.evaluate(
      () => (window as PreviewWindow).__completePreview(),
    )).toBe(true);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);

    await context.close();
  });

  it("rejects a non-positive participant number before the preview starts", async () => {
    const context = await browser.newContext();
    await context.route("http://preview.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head></head><body></body></html>",
      }),
    );
    const page = await context.newPage();
    await page.goto("http://preview.test/");
    const code = buildSelectedPreviewPersistence({
      experimentID: "preview-exp",
      isSaveMode: true,
      selectionName: "Choice",
    });

    await page.evaluate((persistenceCode) => {
      window.fetch = async (_input, init) => {
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          success: true,
          id: body.sessionId,
          participantNumber: 0,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      };
      new Function(`${persistenceCode}
        window.__initPreview = initParticipant;
      `)();
    }, code);

    const result = await page.evaluate(async () => {
      try {
        return { participant: await (window as PreviewWindow).__initPreview() };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
    expect(result).toEqual({ error: "Preview session creation failed" });

    await context.close();
  });
});
