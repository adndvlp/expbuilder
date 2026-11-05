import type { ModelState, WorkspaceDocument } from "./types";
export function toModel(document: WorkspaceDocument): ModelState;
export function modelDocument(state: ModelState): WorkspaceDocument;
export function fromModel(
  state: ModelState,
  original: WorkspaceDocument,
  options?: object,
): { document: WorkspaceDocument; idMap: Record<string, string | number> };
