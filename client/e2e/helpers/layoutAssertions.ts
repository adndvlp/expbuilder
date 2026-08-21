import { expect, type Locator } from "@playwright/test";

async function nodeGeometry(canvas: Locator, nodeId: string) {
  const box = await canvas
    .locator(`.react-flow__node[data-id="${nodeId}"]`)
    .boundingBox();
  expect(box, `missing visible node ${nodeId}`).not.toBeNull();
  return {
    centerX: box!.x + box!.width / 2,
    topY: box!.y,
    bottomY: box!.y + box!.height,
  };
}

async function pathCrossesNode(path: Locator, node: Locator) {
  const bounds = await node.boundingBox();
  if (!bounds) return false;
  return path.evaluate((element, box) => {
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
  }, bounds);
}

export async function expectPathAvoidsNodes(path: Locator, nodes: Locator[]) {
  for (const node of nodes) {
    expect(await pathCrossesNode(path, node)).toBe(false);
  }
}

export async function expectBelowAndCentered(
  canvas: Locator,
  sourceId: string,
  targetId: string,
) {
  const [source, target] = await Promise.all([
    nodeGeometry(canvas, sourceId),
    nodeGeometry(canvas, targetId),
  ]);
  expect(Math.abs(source.centerX - target.centerX)).toBeLessThan(2);
  expect(target.topY).toBeGreaterThan(source.bottomY);
}

export async function expectBalancedFan(
  canvas: Locator,
  sourceId: string,
  childIds: string[],
  exitTargetIds: string[],
) {
  const source = await nodeGeometry(canvas, sourceId);
  const children = await Promise.all(
    childIds.map((childId) => nodeGeometry(canvas, childId)),
  );
  const centers = children.map((child) => child.centerX).sort((a, b) => a - b);
  expect(centers[0]).toBeLessThan(source.centerX);
  expect(centers[centers.length - 1]).toBeGreaterThan(source.centerX);
  expect(
    Math.abs((centers[0]! + centers[centers.length - 1]!) / 2 - source.centerX),
  ).toBeLessThan(2);
  const exits = await Promise.all(
    exitTargetIds.map((targetId) => nodeGeometry(canvas, targetId)),
  );
  exits.forEach((target) =>
    expect(target.topY).toBeGreaterThan(source.bottomY),
  );
}
