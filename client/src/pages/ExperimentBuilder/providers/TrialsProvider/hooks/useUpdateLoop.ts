import { useCallback } from "react";
import type { Loop } from "../../../components/ConfigurationPanel/types";
import type { NewBranchItem } from "../../../contexts/TrialsContext";
import type { ExperimentGraphSnapshot } from "../../../modules/experiment-graph/types";
import type { LoopMethodsWithGetLoop } from "../types";

const API_URL = import.meta.env.VITE_API_URL;
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
      _newBranchItem?: NewBranchItem,
    ): Promise<Loop | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          },
        );
        if (!response.ok) throw new Error("Failed to update loop");

        const data = (await response.json()) as {
          loop: Loop;
          graph: ExperimentGraphSnapshot;
        };
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
