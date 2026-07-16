import { expect, test } from "../fixtures/test.fixture";

const rootTimeline = [
  { id: "welcome", type: "trial", name: "Welcome" },
  { id: "instructions", type: "trial", name: "Instructions" },
  { id: "parent", type: "loop", name: "Parent loop" },
  { id: "final", type: "trial", name: "Final" },
];

const parentTimeline = [
  { id: "parent-first", type: "trial", name: "Parent first" },
  { id: "nested", type: "loop", name: "Nested loop" },
  { id: "parent-last", type: "trial", name: "Parent last" },
];

const nestedTimeline = [
  { id: "nested-first", type: "trial", name: "Nested first" },
  { id: "nested-last", type: "trial", name: "Nested last" },
];

test("expands parent and nested loops inside one ReactFlow", async ({ page }) => {
  await page.route("**/api/trials-metadata/exp-canvas", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timeline: rootTimeline }),
    }),
  );
  await page.route(
    "**/api/loop-trials-metadata/exp-canvas/*",
    (route) => {
      const nested = route.request().url().endsWith("/nested");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trialsMetadata: nested ? nestedTimeline : parentTimeline,
        }),
      });
    },
  );

  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/#/home/experiment/exp-canvas/builder");
  const canvas = page.locator(".canvas-container");
  await expect(canvas.locator(".react-flow")).toHaveCount(1);

  await canvas
    .locator(".loop-node", { hasText: "Parent loop" })
    .getByTitle("Expand loop")
    .click();
  await expect(canvas.getByText("Parent first", { exact: true })).toBeVisible();

  await canvas
    .locator(".loop-node", { hasText: "Nested loop" })
    .getByTitle("Expand loop")
    .click();
  await expect(canvas.getByText("Nested first", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Parent last", { exact: true })).toBeVisible();
  await expect(canvas.locator(".react-flow")).toHaveCount(1);
  await page.waitForTimeout(400);
  await expect(canvas.getByText("Welcome", { exact: true })).toBeInViewport({
    ratio: 0.9,
  });
  await expect(canvas.getByText("Final", { exact: true })).toBeInViewport({
    ratio: 0.9,
  });
  await page.mouse.move(10, 10);
  await canvas.screenshot({
    path: "test-results/unified-canvas-expanded.png",
  });

  await canvas
    .locator(".loop-node", { hasText: "Parent loop" })
    .getByTitle("Collapse loop")
    .click();
  await expect(canvas.getByText("Nested first", { exact: true })).toHaveCount(0);
  await expect(canvas.getByText("Parent first", { exact: true })).toHaveCount(0);
});

test("routes the branching one-item loop without crossed edges", async ({
  page,
}) => {
  const branchingTimeline = [
    { id: "welcome", type: "trial", name: "Welcome", branches: ["consent"] },
    {
      id: "consent",
      type: "trial",
      name: "Consent",
      branches: ["instructions", "final-1"],
    },
    {
      id: "instructions",
      type: "trial",
      name: "Instructions",
      branches: ["loop-1"],
    },
    { id: "final-1", type: "trial", name: "Final1", branches: [] },
    {
      id: "loop-1",
      type: "loop",
      name: "Loop 1",
      branches: ["final-2"],
      trials: ["task"],
    },
    { id: "final-2", type: "trial", name: "Final2", branches: [] },
  ];

  await page.route("**/api/trials-metadata/exp-branching", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timeline: branchingTimeline }),
    }),
  );
  await page.route(
    "**/api/loop-trials-metadata/exp-branching/loop-1",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trialsMetadata: [{ id: "task", type: "trial", name: "Task" }],
        }),
      }),
  );

  await page.setViewportSize({ width: 2000, height: 1200 });
  await page.goto("/#/home/experiment/exp-branching/builder");
  const canvas = page.locator(".canvas-container");
  await canvas
    .locator(".loop-node", { hasText: "Loop 1" })
    .getByTitle("Expand loop")
    .click();

  await expect(canvas.getByText("Task", { exact: true })).toBeVisible();
  await expect(canvas.locator(".react-flow")).toHaveCount(1);
  await expect(canvas.locator(".canvas-breadcrumb")).toHaveCount(0);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  await canvas.screenshot({
    path: "test-results/unified-canvas-single-loop.png",
  });
});
