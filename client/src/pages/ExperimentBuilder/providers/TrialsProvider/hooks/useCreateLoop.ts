import { useCallback } from "react";
import type { Loop } from "../../../components/ConfigurationPanel/types";
import type { ExperimentGraphSnapshot } from "../../../modules/experiment-graph/types";
import type { LoopMethodsProps } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export default function useCreateLoop({
  experimentID,
  applyGraphSnapshot,
  getTimeline,
}: LoopMethodsProps) {
  return useCallback(
    async (loop: Omit<Loop, "id">): Promise<Loop> => {
      try {
        const response = await fetch(`${API_URL}/api/loop/${experimentID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loop),
        });
        if (!response.ok) throw new Error("Failed to create loop");

        const data = (await response.json()) as {
          loop: Loop;
          graph: ExperimentGraphSnapshot;
        };
        applyGraphSnapshot(data.graph);
        return data.loop;
      } catch (error: unknown) {
        console.error("Error creating loop:", error);
        await getTimeline();
        throw error;
      }
    },
    [applyGraphSnapshot, experimentID, getTimeline],
  );
}
