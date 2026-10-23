import { expect, type Locator } from "@playwright/test";

export async function waitForCanvasViewport(canvas: Locator) {
  let previous = "",
    stableReadings = 0;
  await expect
    .poll(
      async () => {
        const current = await canvas
          .locator(".react-flow__viewport")
          .evaluate((element) => getComputedStyle(element).transform);
        stableReadings = current === previous ? stableReadings + 1 : 0;
        previous = current;
        return stableReadings;
      },
      { intervals: [50, 100, 100] },
    )
    .toBeGreaterThanOrEqual(3);
}

export async function readCanvasNodeGeometry(
  canvas: Locator,
  nodeIds: string[],
) {
  await Promise.all(
    nodeIds.map((id) =>
      canvas
        .locator(`.react-flow__node[data-id="${id}"]`)
        .waitFor({ state: "visible" }),
    ),
  );
  return canvas.evaluate((element, ids) => {
    const nodes = new Map(
      [...element.querySelectorAll(".react-flow__node")].map((node) => [
        node.getAttribute("data-id"),
        node,
      ]),
    );
    return ids.map((id) => {
      const node = nodes.get(id);
      if (!node) throw new Error(`missing visible node ${id}`);
      const box = node.getBoundingClientRect();
      return {
        centerX: box.x + box.width / 2,
        topY: box.y,
        bottomY: box.bottom,
      };
    });
  }, nodeIds);
}

async function pathCrossesNode(path: Locator, node: Locator) {
  const nodeElement = await node.elementHandle();
  if (!nodeElement) return false;
  return path.evaluate((element, target) => {
    // Both geometries must use the same animation frame during viewport fitting.
    const box = target.getBoundingClientRect();
    const svgPath = element as SVGPathElement;
    const matrix = svgPath.getScreenCTM();
    if (!matrix) return false;
    const length = svgPath.getTotalLength();
    for (let sample = 1; sample < 100; sample += 1) {
      const point = svgPath.getPointAtLength((length * sample) / 100);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      if (
        screen.x > box.x &&
        screen.x < box.x + box.width &&
        screen.y > box.y &&
        screen.y < box.y + box.height
      ) {
        return true;
      }
    }
    return false;
  }, nodeElement);
}

export async function expectPathAvoidsNodes(path: Locator, nodes: Locator[]) {
  for (const node of nodes) {
    await expect.poll(() => pathCrossesNode(path, node)).toBe(false);
  }
}

export async function expectBelowAndCentered(
  canvas: Locator,
  sourceId: string,
  targetId: string,
) {
  await expect
    .poll(async () => {
      const [source, target] = await readCanvasNodeGeometry(canvas, [
        sourceId,
        targetId,
      ]);
      return Math.abs(source.centerX - target.centerX);
    })
    .toBeLessThan(2);
  await expect
    .poll(async () => {
      const [source, target] = await readCanvasNodeGeometry(canvas, [
        sourceId,
        targetId,
      ]);
      return target.topY - source.bottomY;
    })
    .toBeGreaterThan(0);
}

async function fanGeometry(
  canvas: Locator,
  sourceId: string,
  childIds: string[],
) {
  const [source, ...children] = await readCanvasNodeGeometry(canvas, [
    sourceId,
    ...childIds,
  ]);
  const centers = children.map((child) => child.centerX).sort((a, b) => a - b);
  return {
    source,
    centers,
    fanCenter: (centers[0]! + centers[centers.length - 1]!) / 2,
  };
}

export async function expectBalancedFan(
  canvas: Locator,
  sourceId: string,
  childIds: string[],
  exitTargetIds: string[],
) {
  await expect
    .poll(async () => {
      const { source, centers } = await fanGeometry(canvas, sourceId, childIds);
      return (
        centers[0]! < source.centerX &&
        centers[centers.length - 1]! > source.centerX
      );
    })
    .toBe(true);
  await expect
    .poll(async () => {
      const { source, fanCenter } = await fanGeometry(
        canvas,
        sourceId,
        childIds,
      );
      return Math.abs(fanCenter - source.centerX);
    })
    .toBeLessThan(2);
  const [source, ...exits] = await readCanvasNodeGeometry(canvas, [
    sourceId,
    ...exitTargetIds,
  ]);
  exits.forEach((target) =>
    expect(target.topY).toBeGreaterThan(source.bottomY),
  );
}
