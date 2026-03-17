import { useContext } from "react";
import CanvasStylesContext from "../contexts/CanvasStylesContext";

export default function useCanvasStyles() {
  return useContext(CanvasStylesContext);
}
