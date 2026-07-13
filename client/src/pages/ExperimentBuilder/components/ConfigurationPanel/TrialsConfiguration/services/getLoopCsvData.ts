import type { Loop, Trial } from "../../types";

type GetLoop = (id: string | number) => Promise<Loop | null>;

export async function getLoopCsvData(trial: Trial, getLoop: GetLoop) {
  if (!trial.parentLoopId) return { csvColumns: [] as string[] };

  const parentLoop = await getLoop(trial.parentLoopId);
  return { csvColumns: parentLoop?.csvColumns || [] };
}
