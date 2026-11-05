import type { WorkspaceDocument } from "./types";
export function projectExecutable<T extends WorkspaceDocument>(document: T): T;
export function projectExecutionGraph<
  T extends { workspace?: WorkspaceDocument },
>(graph: T, document?: WorkspaceDocument): T;
