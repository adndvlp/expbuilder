import { useState, useEffect, useCallback } from "react";

export type Size = {
  width: number;
  height: number;
};

export function useResizable(
  initialSize: Size,
  minWidth = 280,
  minHeight = 180,
) {
  const [resizing, setResizing] = useState(false);
  const [size, setSize] = useState(initialSize);
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: initialSize.width,
    height: initialSize.height,
  });

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
  };

  const handleMouseUp = useCallback(() => {
    setResizing(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (resizing) {
        const newWidth = Math.max(
          minWidth,
          resizeStart.width + (e.clientX - resizeStart.x),
        );
        const newHeight = Math.max(
          minHeight,
          resizeStart.height + (e.clientY - resizeStart.y),
        );
        setSize({ width: newWidth, height: newHeight });
      }
    },
    [minHeight, minWidth, resizeStart, resizing],
  );

  useEffect(() => {
    if (resizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, resizeStart, handleMouseMove, handleMouseUp]);

  return {
    resizing,
    size,
    handleResizeMouseDown,
  };
}
