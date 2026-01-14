import { useContext } from "react";
import TrialsContext from "../contexts/TrialsContext";

export default function useTrials() {
  return useContext(TrialsContext);
}
