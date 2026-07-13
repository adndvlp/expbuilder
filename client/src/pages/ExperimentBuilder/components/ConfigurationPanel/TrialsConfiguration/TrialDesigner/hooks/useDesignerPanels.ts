import { useEffect, useRef, useState } from "react";
import useHandleResize from "../useHandleResize";

export function useDesignerPanels(canvasWidth: number, canvasHeight: number) {
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [stageScale, setStageScale] = useState(1);
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
    const updateScale = () => {
      const container = canvasContainerRef.current;
      if (!container) return;
      const scaleX = container.clientWidth / canvasWidth;
      const scaleY = container.clientHeight / canvasHeight;
      setStageScale(Math.min(scaleX, scaleY, 1));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    const intervalId = setInterval(updateScale, 100);
    return () => {
      window.removeEventListener("resize", updateScale);
      clearInterval(intervalId);
    };
  }, [
    canvasHeight,
    canvasWidth,
    leftPanelWidth,
    rightPanelWidth,
    showLeftPanel,
    showRightPanel,
  ]);

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
  };
}
