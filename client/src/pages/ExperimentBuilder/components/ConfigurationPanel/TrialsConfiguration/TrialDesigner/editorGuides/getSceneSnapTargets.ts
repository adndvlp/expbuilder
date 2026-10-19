import type Konva from "konva";
import {
  getHtmlSceneNode,
  type HtmlSceneMetrics,
} from "../experimentalScene/sceneModel";
import type { PreviewViewport, TrialComponent } from "../types";
import { getComponentSnapBox } from "./getComponentSnapBox";
import type { SnapBox } from "./types";

export function nodeSnapBox(node: Konva.Node, id: string): SnapBox {
  const bounds = node.getClientRect({
    relativeTo: node.getParent()!,
    skipStroke: true,
    skipShadow: true,
  });
  return {
    id,
    x: node.x(),
    y: node.y(),
    width: bounds.width,
    height: bounds.height,
    bounds,
  };
}

export function getSceneSnapTargets(
  components: TrialComponent[],
  viewport: PreviewViewport,
  metrics: HtmlSceneMetrics,
  scene: Konva.Container | null,
  movingId: string,
): SnapBox[] {
  const nodes = new Map(
    scene
      ?.find<Konva.Node>(".designer-component")
      .map((node) => [node.id(), node]) ?? [],
  );
  return components
    .filter((component) => component.id !== movingId)
    .map((component) => {
      const rendered = nodes.get(component.id);
      if (rendered) return nodeSnapBox(rendered, component.id);
      const html = getHtmlSceneNode(component, viewport, metrics);
      return html
        ? {
            id: html.id,
            x: html.x,
            y: html.y,
            width: html.width,
            height: html.height,
            rotation: html.rotation,
          }
        : getComponentSnapBox(component, viewport);
    })
    .filter(
      (box) =>
        [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
        box.width > 0 &&
        box.height > 0,
    );
}
