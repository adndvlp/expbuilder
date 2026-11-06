import { test, expect } from "../fixtures/test.fixture";
import {
  branchEdge,
  graph,
  graphScope,
  routeGraph,
} from "../helpers/loopBranchGraph";
import type { TimelineItem } from "../../src/pages/ExperimentBuilder/modules/experiment-graph/types";
import { waitForCanvasViewport } from "../helpers/layoutAssertions";

const trial = (id: string, branches: string[] = []): TimelineItem => ({
  id,
  name: id,
  type: "trial",
  branches,
  defaultNextTrialId: branches[0] ?? null,
});
const loop = (id: string): TimelineItem => ({
  id,
  name: id,
  type: "loop",
  nextItemId: null,
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`shows directed shared destinations and return routes in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    const items = [
      trial("A", ["B", "C"]),
      trial("B", ["D"]),
      trial("C", ["D"]),
      trial("D", ["A"]),
    ];
    const snapshot = graph(
      items,
      {},
      items.flatMap((item) =>
        (item.branches ?? []).map((target) =>
          branchEdge(item.id, target, null, null),
        ),
      ),
    );
    snapshot.root.entryItemId = "A";
    await routeGraph(page, "symmetry", snapshot);
    await page.goto("/#/home/experiment/symmetry/builder");
    const canvas = page.locator(".canvas-container");
    await expect(canvas.locator(".trial-node")).toHaveCount(4);
    await expect(canvas.locator(".react-flow__edge-path")).toHaveCount(5);
    await expect
      .poll(() =>
        canvas
          .locator(".react-flow__edge-path")
          .evaluateAll((paths) =>
            paths.every((path) => Boolean(path.getAttribute("marker-end"))),
          ),
      )
      .toBe(true);
    const position = (name: string) =>
      canvas
        .locator(".trial-node", { hasText: new RegExp(`^${name}$`) })
        .boundingBox();
    await expect
      .poll(async () => {
        const [a, b, c, d] = await Promise.all(
          ["A", "B", "C", "D"].map(position),
        );
        return (
          !!a &&
          !!b &&
          !!c &&
          !!d &&
          a.y < b.y &&
          d.y > c.y &&
          Math.abs((b.x + c.x) / 2 - d.x) < 2
        );
      })
      .toBe(true);
    const colors = await canvas
      .locator(".react-flow__edge-path")
      .evaluateAll((paths) =>
        paths.map((path) => {
          const reference = path
            .getAttribute("marker-end")!
            .slice(4, -1)
            .replaceAll("'", "")
            .replaceAll('"', "")
            .slice(1);
          const marker = document
            .getElementById(reference)
            ?.querySelector("polyline");
          return {
            stroke: getComputedStyle(path).stroke,
            fill: marker ? getComputedStyle(marker).fill : null,
          };
        }),
      );
    colors.forEach((value) => expect(value.fill).toBe(value.stroke));
    await page.mouse.move(0, 0);
    await canvas.screenshot({
      path: `test-results/canvas-symmetry-${colorScheme}.png`,
    });
  });

  test(`keeps nested circuits centered, directed and inside the viewport in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    const root = [trial("A", ["P"]), loop("L0"), trial("T")];
    const parent = [trial("P", ["Q"]), loop("L1")];
    const inner = [trial("Q", ["R"]), loop("L2")];
    const leaf = [trial("R", ["Q", "T"])];
    const snapshot = graph(
      root,
      {
        L0: graphScope("L0", null, parent),
        L1: graphScope("L1", "L0", inner),
        L2: graphScope("L2", "L1", leaf),
      },
      [
        branchEdge("A", "P", null, "L0"),
        branchEdge("P", "Q", "L0", "L1"),
        branchEdge("Q", "R", "L1", "L2"),
        branchEdge("R", "Q", "L2", "L1", ["L2"]),
        branchEdge("R", "T", "L2", null, ["L2", "L1", "L0"]),
      ],
    );
    snapshot.root.entryItemId = "A";
    ["L0", "L1", "L2"].forEach((id, index) => {
      snapshot.scopes[id].entryItemId = ["P", "Q", "R"][index];
    });
    await routeGraph(page, "nested-symmetry", snapshot);
    await page.route(
      "**/api/loop-trials-metadata/nested-symmetry/*",
      (route) => {
        const id = route.request().url().split("/").pop()!;
        return route.fulfill({
          json: { trialsMetadata: snapshot.scopes[id].items },
        });
      },
    );
    await page.goto("/#/home/experiment/nested-symmetry/builder");
    const canvas = page.locator(".canvas-container");
    for (const id of ["L0", "L1", "L2"]) {
      await page.mouse.move(0, 0);
      await waitForCanvasViewport(canvas);
      await canvas
        .locator(".loop-node", { has: page.getByText(id, { exact: true }) })
        .getByTitle("Expand loop")
        .click();
    }
    await expect(canvas.locator(".react-flow__edge.animated")).toHaveCount(3);
    await page.mouse.move(0, 0);
    await expect
      .poll(async () => {
        const box = await canvas.boundingBox();
        return canvas.locator(".react-flow__edge-path").evaluateAll(
          (paths, bounds) =>
            paths.every((path) => {
              const rect = path.getBoundingClientRect();
              return (
                rect.left >= bounds!.x &&
                rect.right <= bounds!.x + bounds!.width &&
                rect.top >= bounds!.y &&
                rect.bottom <= bounds!.y + bounds!.height
              );
            }),
          box,
        );
      })
      .toBe(true);
    const circuits = await canvas
      .locator(".react-flow__edge.animated .react-flow__edge-path")
      .evaluateAll((paths) =>
        paths.map((element) => {
          const path = element as SVGPathElement;
          const start = path.getPointAtLength(0),
            next = path.getPointAtLength(5),
            end = path.getPointAtLength(path.getTotalLength());
          const frames = path.getAnimations()[0].effect!.getKeyframes();
          return {
            x: start.x,
            endX: end.x,
            down: next.y > start.y,
            frames: frames.map((frame) => frame.strokeDashoffset),
          };
        }),
      );
    circuits.forEach((circuit) => {
      expect(circuit.x).toBeCloseTo(circuit.endX);
      expect(circuit.down).toBe(true);
      expect(circuit.frames).toEqual(["10px", "0px"]);
    });
    await waitForCanvasViewport(canvas);
    await canvas
      .locator(".loop-node", { has: page.getByText("L0", { exact: true }) })
      .getByTitle("Collapse loop")
      .click();
    await expect(canvas.locator(".react-flow__edge.animated")).toHaveCount(0);
    await expect(canvas.getByText("R", { exact: true })).toHaveCount(0);
    await page.mouse.move(0, 0);
    await waitForCanvasViewport(canvas);
    await canvas
      .locator(".loop-node", { has: page.getByText("L0", { exact: true }) })
      .getByTitle("Expand loop")
      .click();
    await expect(canvas.getByText("P", { exact: true })).toBeVisible();
    await page.mouse.move(0, 0);
    await canvas.screenshot({
      path: `test-results/canvas-nested-symmetry-${colorScheme}.png`,
    });
  });
}
