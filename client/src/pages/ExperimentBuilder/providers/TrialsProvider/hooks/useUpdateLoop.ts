import { useCallback } from "react";
import type { Loop } from "../../../components/ConfigurationPanel/types";
import { experimentAuthoringClient } from "../../../modules/experiment-authoring";
import type { LoopMethodsWithGetLoop } from "../types";

const idsMatch = (left: string | number, right: string | number) =>
  String(left) === String(right);
const affectsGraph = (updates: Partial<Loop>) =>
  ["name", "branches", "trials", "parentLoopId"].some((field) =>
    Object.prototype.hasOwnProperty.call(updates, field),
  );

export default function useUpdateLoop({
  experimentID,
  applyGraphSnapshot,
  getTimeline,
  setSelectedLoop,
}: LoopMethodsWithGetLoop) {
  return useCallback(
    async (
      id: string | number,
      updates: Partial<Loop>,
    ): Promise<Loop | null> => {
      try {
        const data = await experimentAuthoringClient.updateLoop(
          experimentID,
          id,
          updates,
        );
        if (affectsGraph(updates)) applyGraphSnapshot(data.graph);
        setSelectedLoop((current) =>
          current && idsMatch(current.id, id) ? data.loop : current,
        );
        return data.loop;
      } catch (error: unknown) {
        console.error("Error updating loop:", error);
        if (affectsGraph(updates)) await getTimeline();
        return null;
      }
    },
    [applyGraphSnapshot, experimentID, getTimeline, setSelectedLoop],
  );
}
