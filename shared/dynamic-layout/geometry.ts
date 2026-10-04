export type ViewportSize = { width: number; height: number };

export function relativeCenter(
  coordinates: { x?: number; y?: number } | undefined,
  viewport: ViewportSize,
) {
  return {
    x: ((Number(coordinates?.x ?? 0) + 100) / 200) * viewport.width,
    y: ((100 - Number(coordinates?.y ?? 0)) / 200) * viewport.height,
  };
}

export function relativeLength(value: number, viewport: ViewportSize) {
  // Heights retain the Builder's existing percent-of-width unit.
  return (Number(value) / 100) * viewport.width;
}

export function relativeCoordinates(
  x: number,
  y: number,
  viewport: ViewportSize,
) {
  return {
    x: Math.max(-100, Math.min(100, (x / viewport.width) * 200 - 100)),
    y: Math.max(-100, Math.min(100, 100 - (y / viewport.height) * 200)),
  };
}
