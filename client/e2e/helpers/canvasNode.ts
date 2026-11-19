import type { Locator } from "@playwright/test";

// Layout edge identities remain scoped; workspace nodes use the persisted item ID.
export function canvasItemId(layoutId: string) {
  const match = layoutId.match(/^.+::(?:trial|loop)::(.+)$/);
  return match ? decodeURIComponent(match[1]) : layoutId;
}

export function canvasNode(canvas: Locator, layoutId: string) {
  return canvas.locator(".react-flow__node").filter({
    has: canvas.page().getByTestId(`item-${canvasItemId(layoutId)}`),
  });
}
