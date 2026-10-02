import { useMemo, useState } from "react";
import useCanvasStyles from "../../../../../hooks/useCanvasStyles";
import type { KonvaTrialDesignerProps } from "../types";
import { getInitialCanvasSize } from "../useLoadComponents";

export function useDesignerViewport(
  columnMapping: KonvaTrialDesignerProps["columnMapping"],
) {
  const { canvasStyles: appearanceStyles } = useCanvasStyles();
  const [initialSize] = useState(getInitialCanvasSize);
  const saved = columnMapping.__canvasStyles?.value;
  const width = saved?.width ?? initialSize.width;
  const height = saved?.height ?? initialSize.height;
  // Preserve the designer's original screen size for unsaved trials. Device
  // previews must not replace the size exported to the existing runtime.
  const canvasStyles = useMemo(
    () => ({ ...appearanceStyles, width, height }),
    [appearanceStyles, width, height],
  );
  const [viewportStyles, setPreviewStyles] = useState(canvasStyles);
  const previewStyles = useMemo(
    () => ({
      ...canvasStyles,
      width: viewportStyles.width,
      height: viewportStyles.height,
    }),
    [canvasStyles, viewportStyles.width, viewportStyles.height],
  );

  return { canvasStyles, previewStyles, setPreviewStyles };
}
