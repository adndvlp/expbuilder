import type {
  CreatedLoopBranch,
  LoopBranchLevel,
  LoopBranchMode,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL;

export async function loadLoopBranchLevels(
  experimentId: string,
  sourceTrialId: string | number,
): Promise<LoopBranchLevel[]> {
  const response = await fetch(
    `${API_URL}/api/loop-branch-levels/${experimentId}/${sourceTrialId}`,
  );
  if (!response.ok) throw new Error("Failed to load loop branch levels");
  const data = (await response.json()) as { levels?: LoopBranchLevel[] };
  return data.levels ?? [];
}

export async function createLoopBranch(
  experimentId: string,
  sourceTrialId: string | number,
  targetScopeId: string | null,
  mode: LoopBranchMode,
): Promise<CreatedLoopBranch> {
  const response = await fetch(`${API_URL}/api/loop-branch/${experimentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceTrialId, targetScopeId, mode }),
  });
  if (!response.ok) throw new Error("Failed to create loop branch");
  return (await response.json()) as CreatedLoopBranch;
}
