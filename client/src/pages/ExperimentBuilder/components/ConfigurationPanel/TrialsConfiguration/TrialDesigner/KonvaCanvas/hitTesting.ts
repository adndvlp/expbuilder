import type { HtmlSceneMetrics } from "../experimentalScene/sceneModel";
import type { TrialComponent } from "../types";

export function findTopComponentAtPoint(
  components: TrialComponent[],
  htmlSceneMetrics: HtmlSceneMetrics,
  point: { x: number; y: number },
): string | null {
  const sortedComponents = [...components].sort(
    (first, second) => (second.zIndex ?? 0) - (first.zIndex ?? 0),
  );
  const hit = sortedComponents.find((component) => {
    const metric = htmlSceneMetrics[component.id];
    const width = component.width || metric?.width || 160;
    const height = component.height || metric?.height || 64;
    const box = {
      left: component.x - width / 2,
      right: component.x + width / 2,
      top: component.y - height / 2,
      bottom: component.y + height / 2,
    };
    return (
      point.x >= box.left &&
      point.x <= box.right &&
      point.y >= box.top &&
      point.y <= box.bottom
    );
  });
  return hit?.id ?? null;
}
