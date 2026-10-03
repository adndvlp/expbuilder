import { relativeCenter } from "../../../shared/dynamic-layout/geometry";

export function positionElement(
  element: HTMLElement,
  coordinates?: { x?: number; y?: number },
) {
  const center = relativeCenter(coordinates, { width: 100, height: 100 });
  element.style.left = `${center.x}%`;
  element.style.top = `${center.y}%`;
}
