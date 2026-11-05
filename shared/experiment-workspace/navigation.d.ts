import type { WorkspaceDocument } from "./types";
import type { Trial } from "./records";
export const FINISH: "FINISH_EXPERIMENT";
export function idKey(value: unknown): string | null;
export function convertWorkspace(
  document: WorkspaceDocument,
): WorkspaceDocument;
export function normalizeNavigation(
  trial: Trial,
  options?: { edited?: boolean },
): Trial;
export function deriveConnections(document: WorkspaceDocument): Array<{
  id: string;
  sourceId: number;
  targetId: number;
  refs: Array<{ kind: string; id: string | number }>;
}>;
