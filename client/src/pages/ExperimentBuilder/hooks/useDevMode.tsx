import { useContext } from "react";
import DevModeContext from "../contexts/DevModeContext";

export default function useDevMode() {
  const context = useContext(DevModeContext);
  if (context === undefined) {
    throw new Error("useDevMode must be used within a DevModeProvider");
  }
  return context;
}
