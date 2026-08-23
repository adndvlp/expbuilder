import { useCallback } from "react";
import { experimentAuthoringClient } from "../../../modules/experiment-authoring";
import type { LoopMethodsWithGetLoop } from "../types";

const idsMatch = (left: string | number, right: string | number) =>
  String(left) === String(right);

export default function useDeleteLoop({
  experimentID,
  applyGraphSnapshot,
  getTimeline,
  selectedLoop,
  setSelectedLoop,
}: LoopMethodsWithGetLoop) {
  return useCallback(
    async (id: string | number): Promise<boolean> => {
      try {
        const data = await experimentAuthoringClient.deleteLoop(
          experimentID,
          id,
        );
        applyGraphSnapshot(data.graph);
        if (selectedLoop && idsMatch(selectedLoop.id, id)) {
          setSelectedLoop(null);
        }
        return true;
      } catch (error: unknown) {
        console.error("Error deleting loop:", error);
        await getTimeline();
        return false;
      }
    },
    [
      applyGraphSnapshot,
      experimentID,
      getTimeline,
      selectedLoop,
      setSelectedLoop,
    ],
  );
}
