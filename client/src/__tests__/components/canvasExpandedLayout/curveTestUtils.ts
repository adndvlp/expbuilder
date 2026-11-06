import type { CanvasCubic } from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

export function sampleCurves(curves: CanvasCubic[]) {
  return curves.flatMap((curve) =>
    Array.from({ length: 101 }, (_, step) => {
      const t = step / 100;
      const weights = [
        (1 - t) ** 3,
        3 * (1 - t) ** 2 * t,
        3 * (1 - t) * t ** 2,
        t ** 3,
      ];
      const points = [curve.start, curve.control1, curve.control2, curve.end];
      return {
        x: points.reduce((sum, point, i) => sum + weights[i] * point.x, 0),
        y: points.reduce((sum, point, i) => sum + weights[i] * point.y, 0),
      };
    }),
  );
}
