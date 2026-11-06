import { test, expect } from "../fixtures/test.fixture";
import type { Locator, Page } from "@playwright/test";
import { edgeId, routeGraph } from "../helpers/loopBranchGraph";
import {
  expectBelowAndCentered,
  expectPathAvoidsNodes,
  waitForCanvasViewport,
} from "../helpers/layoutAssertions";
import {
  flatCurveScenarios,
  nestedChain,
  photographedChain,
  scopeNode,
  type CurvedCanvasSnapshot,
} from "../helpers/curvedCanvasScenarios";

async function openGraph(page: Page, value: CurvedCanvasSnapshot) {
  await routeGraph(page, "curves", value);
  await page.route("**/api/loop-trials-metadata/curves/*", (route) => {
    const id = decodeURIComponent(route.request().url().split("/").pop()!);
    return route.fulfill({ json: { trialsMetadata: value.scopes[id].items } });
  });
  await page.goto("/#/home/experiment/curves/builder");
  await expect(
    page.locator(".canvas-container .react-flow__node").first(),
  ).toBeVisible();
  return page.locator(".canvas-container");
}

const node = (canvas: Locator, id: string) =>
  canvas.locator(`.react-flow__node[data-id="${id}"]`);

async function expectCurvesClearAndFramed(canvas: Locator) {
  const nodes = await canvas.locator(".react-flow__node").all();
  for (const edge of await canvas
    .locator(".react-flow__edge:not(.animated)")
    .all()) {
    const path = edge.locator(".react-flow__edge-path");
    await expect(path).toHaveAttribute("d", /C/);
    await expect(path).toHaveAttribute("marker-end", /url/);
    await expect
      .poll(() =>
        edge.evaluate((element) => {
          const path = element.querySelector(
            ".react-flow__edge-path",
          ) as SVGPathElement;
          const matrix = path.getScreenCTM()!;
          const ids = element
            .getAttribute("data-id")!
            .split("::")
            .slice(2)
            .map(decodeURIComponent);
          const handle = (id: string, kind: string) =>
            document
              .querySelector(
                `.react-flow__node[data-id="${id}"] .react-flow__handle[data-handleid="flow-${kind}"]`,
              )!
              .getBoundingClientRect();
          const source = handle(ids[0], "source"),
            target = handle(ids[1], "target");
          const start = path.getPointAtLength(0).matrixTransform(matrix),
            end = path
              .getPointAtLength(path.getTotalLength())
              .matrixTransform(matrix);
          return Math.max(
            Math.abs(start.y - source.bottom),
            Math.abs(end.y - target.top),
          );
        }),
      )
      .toBeLessThan(1);
    await expectPathAvoidsNodes(path, nodes);
  }
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll(".react-flow__edge-path")].every(
          (path) => {
            const box = path.getBoundingClientRect();
            return (
              box.left >= bounds.left &&
              box.right <= bounds.right &&
              box.top >= bounds.top &&
              box.bottom <= bounds.bottom
            );
          },
        );
      }),
    )
    .toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  test(`keeps the photographed chain straight through loop expansion in ${theme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    const canvas = await openGraph(page, photographedChain());
    let firstOpen = false,
      secondOpen = false;
    for (const toggle of [
      null,
      "Loop 1",
      "Loop 2",
      "Loop 2",
      "Loop 1",
      "Loop 1",
    ]) {
      if (toggle) {
        await page.mouse.move(0, 0);
        await waitForCanvasViewport(canvas);
        await canvas
          .locator(".loop-node", {
            has: page.getByText(toggle, { exact: true }),
          })
          .getByRole("button")
          .click();
        // The editor expands one path: opening a root sibling closes the other.
        if (toggle === "Loop 1") {
          firstOpen = !firstOpen;
          if (firstOpen) secondOpen = false;
        } else {
          secondOpen = !secondOpen;
          if (secondOpen) firstOpen = false;
        }
      }
      await page.mouse.move(0, 0);
      const first = firstOpen
        ? scopeNode("Loop 1", "trial", "Ensayo")
        : scopeNode(null, "loop", "Loop 1");
      const second = secondOpen
        ? scopeNode("Loop 2", "trial", "Ensayo 2")
        : scopeNode(null, "loop", "Loop 2");
      const spine = [
        first,
        scopeNode(null, "trial", "Final ensayo"),
        second,
        scopeNode(null, "trial", "Final experimento"),
      ];
      await expect(canvas.locator(".react-flow__node")).toHaveCount(
        4 + Number(firstOpen) + Number(secondOpen),
      );
      for (let i = 1; i < spine.length; i++)
        await expectBelowAndCentered(canvas, spine[i - 1], spine[i]);
      const bypass = canvas.locator(
        `.react-flow__edge[data-id="${edgeId(first, second)}"] .react-flow__edge-path`,
      );
      await expect(bypass).toHaveAttribute("d", /C.*C/);
      await expectCurvesClearAndFramed(canvas);
      if (!secondOpen)
        await canvas.screenshot({
          path: `test-results/canvas-curved-chain-${theme}-${Number(firstOpen)}.png`,
        });
    }
  });

  for (const scenario of flatCurveScenarios) {
    test(`draws ${scenario.name} with clear curves in ${theme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      const canvas = await openGraph(page, scenario.graph());
      await expect(canvas.locator(".trial-node")).toHaveCount(
        scenario.items.length,
      );
      await expect(canvas.locator(".react-flow__edge")).toHaveCount(
        scenario.items.reduce(
          (count, item) => count + (item.branches?.length ?? 0),
          0,
        ),
      );
      for (let i = 1; i < scenario.spine.length; i++)
        await expectBelowAndCentered(
          canvas,
          scopeNode(null, "trial", scenario.spine[i - 1]),
          scopeNode(null, "trial", scenario.spine[i]),
        );
      await page.mouse.move(0, 0);
      await expectCurvesClearAndFramed(canvas);
      for (const [source, target] of scenario.returns ?? []) {
        const path = canvas.locator(
          `.react-flow__edge[data-id="${edgeId(scopeNode(null, "trial", source), scopeNode(null, "trial", target))}"] .react-flow__edge-path`,
        );
        expect((await path.getAttribute("d"))!.match(/C/g)).toHaveLength(2);
        if (source === target) {
          const bounds = await path.evaluate((element) => {
            const { y, height } = (element as SVGPathElement).getBBox();
            return { y, height };
          });
          const value = await node(
            canvas,
            scopeNode(null, "trial", source),
          ).evaluate((element) => ({
            top: Number(
              (element as HTMLElement).style.transform.match(
                /,\s*([\d.-]+)px/,
              )![1],
            ),
            height: (element as HTMLElement).offsetHeight,
          }));
          expect(bounds.y).toBeGreaterThan(value.top - 50);
          expect(bounds.y + bounds.height).toBeLessThan(
            value.top + value.height + 50,
          );
        }
      }
      await canvas.screenshot({
        path: `test-results/canvas-curves-${scenario.name.replaceAll(" ", "-")}-${theme}.png`,
      });
    });
  }

  test(`keeps nested entries and their exterior continuation aligned in ${theme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    const canvas = await openGraph(page, nestedChain());
    for (const id of ["L1", "L2"]) {
      await page.mouse.move(0, 0);
      await waitForCanvasViewport(canvas);
      await canvas
        .locator(".loop-node", { has: page.getByText(id, { exact: true }) })
        .getByTitle("Expand loop")
        .click();
    }
    await page.mouse.move(0, 0);
    const spine = [
      scopeNode(null, "trial", "A"),
      scopeNode("L1", "trial", "P"),
      scopeNode("L2", "trial", "Q"),
      scopeNode("L1", "trial", "R"),
      scopeNode(null, "trial", "T"),
    ];
    for (let i = 1; i < spine.length; i++)
      await expectBelowAndCentered(canvas, spine[i - 1], spine[i]);
    await expectCurvesClearAndFramed(canvas);
    await canvas.screenshot({
      path: `test-results/canvas-curves-nested-${theme}.png`,
    });
    await waitForCanvasViewport(canvas);
    await node(canvas, scopeNode("L1", "loop", "L2"))
      .getByTitle("Collapse loop")
      .click();
    await expectBelowAndCentered(
      canvas,
      spine[1],
      scopeNode("L1", "loop", "L2"),
    );
    await expectBelowAndCentered(
      canvas,
      scopeNode("L1", "loop", "L2"),
      spine[3],
    );
    await expectCurvesClearAndFramed(canvas);
  });
}
