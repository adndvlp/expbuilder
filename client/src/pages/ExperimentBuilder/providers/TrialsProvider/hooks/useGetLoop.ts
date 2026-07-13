import { useCallback } from "react";
import { Loop } from "../../../components/ConfigurationPanel/types";
import { LoopMethodsProps } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export default function useGetLoop({ experimentID }: LoopMethodsProps) {
  return useCallback(
    async (id: string | number): Promise<Loop | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data.loop;
      } catch (error) {
        console.error("Error getting loop:", error);
        return null;
      }
    },
    [experimentID],
  );
}
