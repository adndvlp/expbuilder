import { useEffect } from "react";

type Props = {
  isResizingLeft: React.RefObject<boolean>;
  setShowLeftPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setLeftPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  isResizingRight: React.RefObject<boolean>;
  setShowRightPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setRightPanelWidth: React.Dispatch<React.SetStateAction<number>>;
};

export default function useHandleResize({
  isResizingLeft,
  setShowLeftPanel,
  setLeftPanelWidth,
  isResizingRight,
  setShowRightPanel,
  setRightPanelWidth,
}: Props) {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current) {
        const newWidth = Math.max(0, e.clientX - 20);
        if (newWidth < 200) {
          setShowLeftPanel(false);
        } else {
          setLeftPanelWidth(newWidth);
          setShowLeftPanel(true);
        }
      }

      if (isResizingRight.current) {
        const modalWidth = window.innerWidth * 0.95;
        const newWidth = Math.max(0, modalWidth - e.clientX);
        if (newWidth < 300) {
          setShowRightPanel(false);
        } else {
          setRightPanelWidth(newWidth);
          setShowRightPanel(true);
        }
      }
    };

    const stopResizing = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResizing);
    };

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResizing);
    };
  }, [
    isResizingLeft,
    isResizingRight,
    setLeftPanelWidth,
    setShowLeftPanel,
    setRightPanelWidth,
    setShowRightPanel,
  ]);
}
