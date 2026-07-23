import { expect, test } from "../fixtures/test.fixture";
import { getScopedNodeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import { ROOT_CANVAS_SCOPE_ID } from "../../src/pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const timeline = [
  { id: "start", type: "trial", name: "Start" },
  {
    id: "question",
    type: "trial",
    name: "Question",
    branches: ["left", "middle", "right"],
  },
  {
    id: "left",
    type: "trial",
    name: "Left",
    branches: ["left-step"],
  },
  {
    id: "left-step",
    type: "trial",
    name: "Left step",
    branches: ["merge"],
  },
  {
    id: "middle",
    type: "trial",
    name: "Middle",
    branches: ["middle-step"],
  },
  {
    id: "middle-step",
    type: "trial",
    name: "Middle step",
    branches: ["merge"],
  },
  {
    id: "right",
    type: "trial",
    name: "Right",
    branches: ["right-step"],
  },
  {
    id: "right-step",
    type: "trial",
    name: "Right step",
    branches: ["merge"],
  },
  { id: "merge", type: "trial", name: "Merge" },
  { id: "after", type: "trial", name: "After" },
];

const nodeId = (itemId: string) =>
  getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", itemId);

const edgeId = (source: string, target: string) =>
  ["edge", "flow", nodeId(source), nodeId(target)]
    .map(encodeURIComponent)
    .join("::");

const expected = {
  light: {
    neutral: "rgb(102, 112, 133)",
    left: "rgb(180, 35, 24)",
    middle: "rgb(6, 118, 71)",
    right: "rgb(16, 24, 40)",
  },
  dark: {
    neutral: "rgb(184, 192, 204)",
    left: "rgb(255, 123, 114)",
    middle: "rgb(74, 222, 128)",
    right: "rgb(255, 255, 255)",
  },
} as const;

for (const theme of ["light", "dark"] as const) {
  test(`keeps trial branches readable in ${theme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.route("**/api/trials-metadata/exp-branch-colors", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ timeline }),
      }),
    );
    await page.setViewportSize({ width: 1800, height: 1100 });
    await page.goto("/#/home/experiment/exp-branch-colors/builder");

    const canvas = page.locator(".canvas-container");
    await expect(canvas.getByText("Merge", { exact: true })).toBeVisible();
    const stroke = async (source: string, target: string) =>
      canvas
        .locator(
          `[data-testid="rf__edge-${edgeId(source, target)}"] .react-flow__edge-path`,
        )
        .evaluate((path) => getComputedStyle(path).stroke);

    expect(await stroke("start", "question")).toBe(expected[theme].neutral);
    expect(await stroke("question", "left")).toBe(expected[theme].left);
    expect(await stroke("left", "left-step")).toBe(expected[theme].left);
    expect(await stroke("left-step", "merge")).toBe(expected[theme].left);
    expect(await stroke("question", "middle")).toBe(expected[theme].middle);
    expect(await stroke("question", "right")).toBe(expected[theme].right);
    expect(await stroke("right-step", "merge")).toBe(expected[theme].right);
    expect(await stroke("merge", "after")).toBe(expected[theme].neutral);

    await canvas.screenshot({
      path: `test-results/branch-edge-colors-${theme}.png`,
    });
  });
}
