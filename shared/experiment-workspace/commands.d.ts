import type { WorkspaceDocument, WorkspaceCommand } from "./types";
export function applyWorkspaceCommand(
  document: WorkspaceDocument,
  command: WorkspaceCommand,
  options?: object,
): {
  document: WorkspaceDocument;
  idMap: Record<string, string | number>;
  result: unknown;
};
export function copyWorkspaceItems(
  document: WorkspaceDocument,
  ids: (string | number)[],
  options?: object,
): unknown;
