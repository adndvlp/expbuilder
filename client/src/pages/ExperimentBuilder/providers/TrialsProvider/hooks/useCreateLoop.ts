import { useCallback } from "react";
import type { Loop } from "../../../components/ConfigurationPanel/types";
import { experimentAuthoringClient } from "../../../modules/experiment-authoring";
import type { LoopMethodsProps } from "../types";

export default function useCreateLoop({
  experimentID,
  applyGraphSnapshot,
  getTimeline,
}: LoopMethodsProps) {
  return useCallback(
    async (loop: Omit<Loop, "id">): Promise<Loop> => {
      try {
        const data = await experimentAuthoringClient.createLoop(
          experimentID,
          loop,
        );
        applyGraphSnapshot(data.graph);
        return data.loop;
      } catch (error: unknown) {
        console.error("Error creating loop:", error);
        await getTimeline();
        const failure = new Error("Failed to create loop") as Error & {
          cause?: unknown;
        };
        failure.cause = error;
        throw failure;
      }
    },
    [applyGraphSnapshot, experimentID, getTimeline],
  );
}
