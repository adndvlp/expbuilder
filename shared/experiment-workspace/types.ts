import type { Trial, Loop, BranchCondition } from "./records";
export type ItemId = string | number;
export type Point = { x: number; y: number };
export type WorkspaceDocument = {
  experimentID: string;
  workspaceSchemaVersion?: number;
  authoringRevision?: string;
  updatedAt?: string;
  entryItemId: ItemId | null;
  timeline: Array<{ id: ItemId; type: "trial" | "loop"; name?: string }>;
  trials: Trial[];
  loops: Loop[];
  editorLayout?: { positionsByItemId: Record<string, Point> };
};
export type ModelRule = Omit<BranchCondition, "id" | "nextTrialId"> & {
  id: ItemId;
  targetId: string | null;
};
export type ModelTrial = Omit<
  Trial,
  "id" | "parentLoopId" | "defaultNextTrialId" | "destinationOrder"
> & {
  id: string;
  parentLoopId: string | null;
  defaultNextTrialId: string | null;
  destinationOrder?: string[];
  thenGoTo: ModelRule[];
};
export type ModelLoop = Omit<
  Loop,
  "entryItemId" | "nextItemId" | "parentLoopId"
> & {
  parentLoopId: string | null;
  entryId: string | null;
  nextId: string | null;
  expanded: boolean;
};
export type ModelState = {
  schema: string;
  name: string;
  entryId: string | null;
  trials: ModelTrial[];
  loops: ModelLoop[];
  anchors: Record<string, Point>;
  scopeOrder: Record<string, string[]>;
  sequence: number;
  notes: string[];
};
export type ModelComponent = {
  key: string;
  ids: Set<string>;
  trials: Set<string>;
  locked: boolean;
  attached: boolean;
};
export type ModelConnection = {
  id: string;
  source: string;
  target: string;
  refs: Array<{ kind: string; id: ItemId }>;
};
export type StructureEndpoints = {
  entryId: string;
  exitId: string;
  ids: string[];
};
export type WorkspaceCommand = {
  kind: string;
  args?: Record<string, unknown>;
  expectedRevision?: string;
};
export type Delta = {
  path: (string | number)[];
  hasBefore: boolean;
  hasAfter: boolean;
  before?: unknown;
  after?: unknown;
  indexBefore?: number;
  indexAfter?: number;
};
