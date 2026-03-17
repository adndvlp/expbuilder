import { createContext } from "react";
import {
  CanvasStyles,
  DEFAULT_CANVAS_STYLES,
} from "../components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

type CanvasStylesContextType = {
  canvasStyles: CanvasStyles;
  setCanvasStyles: React.Dispatch<React.SetStateAction<CanvasStyles>>;
};

const CanvasStylesContext = createContext<CanvasStylesContextType>({
  canvasStyles: DEFAULT_CANVAS_STYLES,
  setCanvasStyles: () => {},
});

export default CanvasStylesContext;
