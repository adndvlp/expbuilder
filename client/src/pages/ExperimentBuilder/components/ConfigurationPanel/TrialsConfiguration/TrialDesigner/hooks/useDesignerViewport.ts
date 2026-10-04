import { useState } from "react";
import type { PreviewViewport } from "../types";
import { getInitialCanvasSize } from "../useLoadComponents";

export function useDesignerViewport() {
  const [previewViewport, setPreviewViewport] =
    useState<PreviewViewport>(getInitialCanvasSize);

  return { previewViewport, setPreviewViewport };
}
