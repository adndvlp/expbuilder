import type { WorkspaceDocument } from "./types";
export function executionRevision(
  document: WorkspaceDocument,
  resources?: unknown[],
  contract?: string,
): Promise<string>;
