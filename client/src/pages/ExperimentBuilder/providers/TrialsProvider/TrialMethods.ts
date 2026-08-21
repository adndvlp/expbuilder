import { useCallback } from "react";
import type { Trial } from "../../components/ConfigurationPanel/types";
import type { ExperimentGraphSnapshot } from "../../modules/experiment-graph/types";
import type { TrialMethodsProps } from "./types";

const API_URL = import.meta.env.VITE_API_URL;
const idsMatch = (left: string | number, right: string | number) =>
  String(left) === String(right);
const hasField = (updates: Partial<Trial>, field: keyof Trial) =>
  Object.prototype.hasOwnProperty.call(updates, field);
const affectsGraph = (updates: Partial<Trial>) =>
  hasField(updates, "name") ||
  hasField(updates, "branches") ||
  hasField(updates, "parentLoopId");

type TrialMutationResponse = {
  trial: Trial;
  graph: ExperimentGraphSnapshot;
};

export default function useTrialMethods({
  getSelectedTrial,
  experimentID,
  applyGraphSnapshot,
  getTimeline,
  setSelectedTrial,
}: TrialMethodsProps) {
  const createTrial = useCallback(
    async (trial: Omit<Trial, "id">): Promise<Trial> => {
      try {
        const response = await fetch(`${API_URL}/api/trial/${experimentID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trial),
        });
        if (!response.ok) throw new Error("Failed to create trial");

        const data = (await response.json()) as TrialMutationResponse;
        applyGraphSnapshot(data.graph);
        return data.trial;
      } catch (error: unknown) {
        console.error("Error creating trial:", error);
        await getTimeline();
        throw error;
      }
    },
    [applyGraphSnapshot, experimentID, getTimeline],
  );

  const getTrial = useCallback(
    async (id: string | number): Promise<Trial | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
        );
        if (!response.ok) return null;
        return ((await response.json()) as { trial: Trial }).trial;
      } catch (error: unknown) {
        console.error("Error getting trial:", error);
        return null;
      }
    },
    [experimentID],
  );

  const updateTrial = useCallback(
    async (
      id: string | number,
      updates: Partial<Trial>,
      _newBranchTrial?: Trial,
    ): Promise<Trial | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          },
        );
        if (!response.ok) throw new Error("Failed to update trial");

        const data = (await response.json()) as TrialMutationResponse;
        if (affectsGraph(updates)) applyGraphSnapshot(data.graph);
        setSelectedTrial((current) =>
          current && idsMatch(current.id, id) ? data.trial : current,
        );
        return data.trial;
      } catch (error: unknown) {
        console.error("Error updating trial:", error);
        if (affectsGraph(updates)) await getTimeline();
        return null;
      }
    },
    [applyGraphSnapshot, experimentID, getTimeline, setSelectedTrial],
  );

  const updateTrialField = useCallback(
    async (
      id: string | number,
      fieldName: string,
      value: unknown,
      updateSelectedTrial = true,
    ): Promise<boolean> => {
      const updates = { [fieldName]: value } as Partial<Trial>;
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          },
        );
        if (!response.ok) throw new Error(`Failed to update ${fieldName}`);

        const data = (await response.json()) as TrialMutationResponse;
        if (affectsGraph(updates)) applyGraphSnapshot(data.graph);
        if (updateSelectedTrial) {
          setSelectedTrial((current) =>
            current && idsMatch(current.id, id) ? data.trial : current,
          );
        }
        return true;
      } catch (error: unknown) {
        console.error(`Error updating ${fieldName}:`, error);
        const freshTrial = await getTrial(id);
        if (freshTrial && updateSelectedTrial) {
          setSelectedTrial((current) =>
            current && idsMatch(current.id, id) ? freshTrial : current,
          );
        }
        if (affectsGraph(updates)) await getTimeline();
        return false;
      }
    },
    [applyGraphSnapshot, experimentID, getTimeline, getTrial, setSelectedTrial],
  );

  const deleteTrial = useCallback(
    async (id: string | number): Promise<boolean> => {
      try {
        const response = await fetch(
          `${API_URL}/api/trial/${experimentID}/${id}`,
          { method: "DELETE" },
        );
        if (!response.ok) throw new Error("Failed to delete trial");

        const data = (await response.json()) as {
          graph: ExperimentGraphSnapshot;
        };
        applyGraphSnapshot(data.graph);
        const selected = getSelectedTrial();
        if (selected && idsMatch(selected.id, id)) setSelectedTrial(null);
        return true;
      } catch (error: unknown) {
        console.error("Error deleting trial:", error);
        await getTimeline();
        return false;
      }
    },
    [
      applyGraphSnapshot,
      experimentID,
      getSelectedTrial,
      getTimeline,
      setSelectedTrial,
    ],
  );

  return { createTrial, getTrial, updateTrial, updateTrialField, deleteTrial };
}
