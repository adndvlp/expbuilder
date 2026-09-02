import { useCallback } from "react";
import type { Loop } from "../../../components/ConfigurationPanel/types";
import { experimentAuthoringClient } from "../../../modules/experiment-authoring";
import type { LoopMethodsWithGetLoop } from "../types";

const idsMatch = (left: string | number, right: string | number) =>
  String(left) === String(right);
const graphFields = new Set(["name", "branches", "trials", "parentLoopId"]);

export default function useUpdateLoopField({
  experimentID,
  applyGraphSnapshot,
  getTimeline,
  setSelectedLoop,
  getLoop,
}: LoopMethodsWithGetLoop) {
  return useCallback(
    async (
      id: string | number,
      fieldName: string,
      value: unknown,
      updateSelectedLoop = true,
    ): Promise<boolean> => {
      try {
        const data = await experimentAuthoringClient.updateLoop(
          experimentID,
          id,
          { [fieldName]: value } as Partial<Loop>,
        );
        if (graphFields.has(fieldName)) applyGraphSnapshot(data.graph);
        if (updateSelectedLoop) {
          setSelectedLoop((current) =>
            current && idsMatch(current.id, id) ? data.loop : current,
          );
        }
        return true;
      } catch (error: unknown) {
        console.error(`Error updating ${fieldName}:`, error);
        const freshLoop = await getLoop(id);
        if (freshLoop && updateSelectedLoop) {
          setSelectedLoop((current) =>
            current && idsMatch(current.id, id) ? freshLoop : current,
          );
        }
        if (graphFields.has(fieldName)) await getTimeline();
        return false;
      }
    },
    [
      applyGraphSnapshot,
      experimentID,
      getLoop,
      getTimeline,
      setSelectedLoop,
    ],
  );
}
