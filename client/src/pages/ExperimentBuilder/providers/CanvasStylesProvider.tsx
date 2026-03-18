import { ReactNode, useEffect, useState } from "react";
import CanvasStylesContext from "../contexts/CanvasStylesContext";
import {
  CanvasStyles,
  DEFAULT_CANVAS_STYLES,
} from "../components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const API_URL = import.meta.env.VITE_API_URL;

export default function CanvasStylesProvider({
  children,
  experimentID,
}: {
  children: ReactNode;
  experimentID?: string;
}) {
  const [canvasStyles, setCanvasStyles] = useState<CanvasStyles>(
    DEFAULT_CANVAS_STYLES,
  );

  // Load appearance settings (backgroundColor, fullScreen) from the server on mount
  useEffect(() => {
    if (!experimentID) return;
    fetch(`${API_URL}/api/appearance-settings/${experimentID}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.settings) {
          setCanvasStyles((prev) => ({
            ...prev,
            backgroundColor:
              data.settings.backgroundColor ?? prev.backgroundColor,
            fullScreen: data.settings.fullScreen ?? prev.fullScreen,
          }));
        }
      })
      .catch((err) => console.warn("Could not load appearance settings:", err));
  }, [experimentID]);

  return (
    <CanvasStylesContext.Provider value={{ canvasStyles, setCanvasStyles }}>
      {children}
    </CanvasStylesContext.Provider>
  );
}
