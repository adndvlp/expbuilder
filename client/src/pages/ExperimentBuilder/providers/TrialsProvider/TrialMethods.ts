import { useCallback } from "react";
import type { Trial } from "../../components/ConfigurationPanel/types";
import { experimentAuthoringClient } from "../../modules/experiment-authoring";
import type { TrialMethodsProps } from "./types";

const idsMatch = (left: string | number, right: string | number) =>
  String(left) === String(right);
const hasField = (updates: Partial<Trial>, field: keyof Trial) =>
  Object.prototype.hasOwnProperty.call(updates, field);
const affectsGraph = (updates: Partial<Trial>) =>
  hasField(updates, "name") ||
  hasField(updates, "branches") ||
  hasField(updates, "parentLoopId");

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
        const data = await experimentAuthoringClient.createTrial(
          experimentID,
          trial,
        );
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
        return await experimentAuthoringClient.getTrial(experimentID, id);
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
    ): Promise<Trial | null> => {
      try {
        const data = await experimentAuthoringClient.updateTrial(
          experimentID,
          id,
          updates,
        );
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
        const data = await experimentAuthoringClient.updateTrial(
          experimentID,
          id,
          updates,
        );
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
        const data = await experimentAuthoringClient.deleteTrial(
          experimentID,
          id,
        );
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
