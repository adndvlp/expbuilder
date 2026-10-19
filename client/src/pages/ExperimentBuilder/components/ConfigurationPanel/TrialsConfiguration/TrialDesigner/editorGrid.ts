import type { PreviewViewport } from "./types";

export const GRID_DIVISIONS = 20;
export type GridLine = { key: string; position: number; major: boolean };
export type ViewportGrid = {
  vertical: GridLine[];
  horizontal: GridLine[];
  spacingX: number;
  spacingY: number;
};

export function createViewportGrid(viewport: PreviewViewport): ViewportGrid {
  const lines = (length: number, axis: string) =>
    Array.from({ length: GRID_DIVISIONS + 1 }, (_, index) => ({
      key: `grid-${axis}-${index}`,
      position: (length * index) / GRID_DIVISIONS,
      major: index % 5 === 0,
    }));
  return {
    vertical: lines(viewport.width, "x"),
    horizontal: lines(viewport.height, "y"),
    spacingX: viewport.width / GRID_DIVISIONS,
    spacingY: viewport.height / GRID_DIVISIONS,
  };
}
