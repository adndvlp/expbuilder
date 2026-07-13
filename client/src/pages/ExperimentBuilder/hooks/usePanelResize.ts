import { useRef, useState } from "react";

export function usePanelResize() {
  const [showTimeline, setShowTimeline] = useState(true);
  const [showConfig, setShowConfig] = useState(true);
  const [timelineWidth, setTimelineWidth] = useState(
    () => window.innerWidth * 0.2,
  );
  const [configWidth, setConfigWidth] = useState(() => window.innerWidth * 0.3);
  const isResizingTimeline = useRef(false);
  const isResizingConfig = useRef(false);

  const handleMouseMove = (event: MouseEvent) => {
    if (isResizingTimeline.current) {
      const newWidth = Math.max(0, event.clientX);
      if (newWidth < 250) setShowTimeline(false);
      else {
        setTimelineWidth(newWidth);
        setShowTimeline(true);
      }
    }
    if (isResizingConfig.current) {
      const newWidth = Math.max(0, window.innerWidth - event.clientX);
      if (newWidth < 400) setShowConfig(false);
      else {
        setConfigWidth(newWidth);
        setShowConfig(true);
      }
    }
  };
  const stopResizing = () => {
    isResizingTimeline.current = false;
    isResizingConfig.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
  };
  const startResize = (target: "timeline" | "config") => {
    if (target === "timeline") isResizingTimeline.current = true;
    else isResizingConfig.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
  };

  return {
    showTimeline,
    setShowTimeline,
    showConfig,
    setShowConfig,
    timelineWidth,
    configWidth,
    initResizeTimeline: () => startResize("timeline"),
    initResizeConfig: () => startResize("config"),
  };
}
