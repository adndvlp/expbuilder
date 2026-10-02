import { useEffect, useRef, useState } from "react";
import useHandleResize from "../useHandleResize";

export function useDesignerPanels(
  canvasWidth: number,
  canvasHeight: number,
  previewSize: { width: number; height: number },
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
          container.clientWidth / previewSize.width,
          container.clientHeight / previewSize.height,
          1,
        ),
      );
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isOpen, previewSize.width, previewSize.height]);

  // The runtime fits the entire reference scene into the selected viewport.
  // The editor then fits that viewport into the available panel space.
  const stageScale =
    viewportFit *
    Math.min(
      previewSize.width / canvasWidth,
      previewSize.height / canvasHeight,
    );

  const fromJsPsychCoords = (coords: { x: number; y: number }) => ({
    x: canvasWidth / 2 + (coords.x / 100) * (canvasWidth / 2),
    y: canvasHeight / 2 - (coords.y / 100) * (canvasHeight / 2),
  });

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
    viewportWidth: previewSize.width * viewportFit,
    viewportHeight: previewSize.height * viewportFit,
  };
}
