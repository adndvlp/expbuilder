import type { Page } from "@playwright/test";
import { setupWorkspaceFixture } from "./workspace.mock";
import { setupApiEnvironmentRoutes } from "./apiEnvironment.mock";

export async function setupApiRoutes(page: Page) {
  const workspace = setupWorkspaceFixture(page);
  await setupApiEnvironmentRoutes(page);

  // --- Main API handler ---
  await page.route("**/api/**", async (route) => {
    if (await workspace.handle(route)) return;
    const url = route.request().url();
    const method = route.request().method();

    // Experiment CRUD
    if (url.includes("/api/load-experiments")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          experiments: [
            {
              experimentID: "exp-001",
              name: "Stroop Task",
              description: "Classic Stroop task",
            },
            {
              experimentID: "exp-002",
              name: "Visual Search",
              description: "Visual search paradigm",
            },
            {
              experimentID: "exp-003",
              name: "Memory Recall",
              description: "Free recall task",
            },
          ],
        }),
      });
    }
    if (url.includes("/api/create-experiment") && method === "POST") {
      const body = route.request().postDataJSON() || {};
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          experiment: {
            experimentID: `exp-${Date.now()}`,
            name: body.name || "New Experiment",
          },
        }),
      });
    }
    if (url.includes("/api/delete-experiment/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }

    // Experiment detail (exact match, no sub-paths)
    if (/\/api\/experiment\/[^/]+$/.test(url) && method === "GET") {
      const match = url.match(/\/api\/experiment\/([^/?]+)/);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          experiment: {
            experimentID: match?.[1] || "unknown",
            name: "Test Experiment",
          },
        }),
      });
    }

    // Experiment name lookup
    if (url.includes("/api/experiment/name/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ name: "Test Experiment" }),
      });
    }

    // Trials metadata
    if (url.includes("/api/trials-metadata/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ timeline: [], loops: [] }),
      });
    }

    // Loop trials metadata
    if (url.includes("/api/loop-trials-metadata/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ timeline: [] }),
      });
    }

    // Trials extensions
    if (url.includes("/api/trials-extensions/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ extensions: [] }),
      });
    }

    // Trials preview
    if (url.includes("/api/trials-preview/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ preview: "" }),
      });
    }

    // Config save/load
    if (url.includes("/api/save-config/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }
    if (url.includes("/api/load-config/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          config: {},
          devMode: false,
          saveMode: false,
          customInitParams: "",
          customPreInitCode: "",
        }),
      });
    }

    // Trial/Loop save
    if (url.includes("/api/save-trial/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }
    if (url.includes("/api/save-loop/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }

    // Plugin endpoints
    if (
      url.includes("/api/plugins-list") ||
      url.includes("/api/load-plugins")
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plugins: [],
          availablePlugins: [],
        }),
      });
    }
    if (url.includes("/api/plugin/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    // Appearance settings
    if (url.includes("/api/appearance-settings/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          backgroundColor: "#ffffff",
          dimensions: { width: 800, height: 600 },
          fullscreen: false,
        }),
      });
    }

    // File management
    if (url.includes("/api/list-files/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ files: [] }),
      });
    }

    // Session name config
    if (url.includes("/api/session-name-config/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ config: {} }),
      });
    }

    // Sessions/Results
    if (url.includes("/api/sessions/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [] }),
      });
    }

    // Export/Import
    if (url.includes("/api/export-all-experiments")) {
      return route.fulfill({
        status: 200,
        contentType: "application/zip",
        body: Buffer.from("mock-zip"),
      });
    }
    if (url.includes("/api/export-experiment/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/zip",
        body: Buffer.from("mock-zip"),
      });
    }
    if (url.includes("/api/import-experiments")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, imported: 2 }),
      });
    }

    // Default: empty object
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Static assets
  await page.route("**/img/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgo=", "base64"),
    });
  });
  await page.route("**/metadata/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}
