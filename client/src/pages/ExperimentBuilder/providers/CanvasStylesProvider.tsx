import { ReactNode, useState } from "react";
import CanvasStylesContext from "../contexts/CanvasStylesContext";
import {
  CanvasStyles,
  DEFAULT_CANVAS_STYLES,
} from "../components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

export default function CanvasStylesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [canvasStyles, setCanvasStyles] =
    useState<CanvasStyles>(DEFAULT_CANVAS_STYLES);

  return (
    <CanvasStylesContext.Provider value={{ canvasStyles, setCanvasStyles }}>
      {children}
    </CanvasStylesContext.Provider>
  );
}
