import { relativeCenter } from "../../../../../../../../../shared/dynamic-layout/geometry";
import { useEffect, useRef, useState } from "react";
import useHandleResize from "../useHandleResize";
import type { PreviewViewport } from "../types";

export function useDesignerPanels(
  previewViewport: PreviewViewport,
  isOpen: boolean,
) {
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [viewportFit, setViewportFit] = useState(1);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useHandleResize({
    isResizingLeft,
    setShowLeftPanel,
    setLeftPanelWidth,
    isResizingRight,
    setRightPanelWidth,
    setShowRightPanel,
  });

  useEffect(() => {
    if (!isOpen) return;
    const container = canvasContainerRef.current;
    if (!container) return;
    const updateScale = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      setViewportFit(
        Math.min(
          container.clientWidth / previewViewport.width,
          container.clientHeight / previewViewport.height,
          1,
        ),
      );
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isOpen, previewViewport.width, previewViewport.height]);

  const stageScale = viewportFit;

  const fromJsPsychCoords = (coords: { x: number; y: number }) =>
    relativeCenter(coords, previewViewport);

  return {
    canvasContainerRef,
    fromJsPsychCoords,
    isResizingLeft,
    isResizingRight,
    leftPanelWidth,
    rightPanelWidth,
    setLeftPanelWidth,
    setRightPanelWidth,
    setShowLeftPanel,
    setShowRightPanel,
    showLeftPanel,
    showRightPanel,
    stageScale,
    viewportWidth: previewViewport.width * viewportFit,
    viewportHeight: previewViewport.height * viewportFit,
  };
}
