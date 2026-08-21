import { useCallback } from "react";
import type { ExperimentGraphSnapshot } from "../../../modules/experiment-graph/types";
import type { LoopMethodsWithGetLoop } from "../types";

const API_URL = import.meta.env.VITE_API_URL;
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
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          { method: "DELETE" },
        );
        if (!response.ok) throw new Error("Failed to delete loop");

        const data = (await response.json()) as {
          graph: ExperimentGraphSnapshot;
        };
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
