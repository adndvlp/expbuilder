import { useCallback } from "react";
import { Loop } from "../../../components/ConfigurationPanel/types";
import { LoopMethodsProps } from "../types";
import { experimentAuthoringClient } from "../../../modules/experiment-authoring";

export default function useGetLoop({ experimentID }: LoopMethodsProps) {
  return useCallback(
    async (id: string | number): Promise<Loop | null> => {
      try {
        return await experimentAuthoringClient.getLoop(experimentID, id);
      } catch (error) {
        console.error("Error getting loop:", error);
        return null;
      }
    },
    [experimentID],
  );
}
