import type { Trial, Loop, BranchCondition } from "./records.js";
export type ItemId = string | number;
export type Point = { x: number; y: number };
export type Placement = "sequential" | "parallel";
export type Pair = { source: string; target: string };
export type TimelineEntry = {
  id: ItemId;
  type: "trial" | "loop";
  name?: string;
};
export type WorkspaceDocument = {
  experimentID: string;
  name?: string;
  workspaceSchemaVersion?: number;
  authoringRevision?: string;
  updatedAt?: string;
  nextWorkspaceTrialId?: number;
  nextWorkspaceLoopId?: number;
  entryItemId: ItemId | null;
  timeline: TimelineEntry[];
  trials: Trial[];
  loops: Loop[];
  editorLayout?: { positionsByItemId: Record<string, Point> };
};
export type GraphRule = Omit<BranchCondition, "id" | "nextTrialId"> & {
  id: ItemId;
  nextTrialId: ItemId | null;
};
export type GraphTrial = Partial<
  Omit<Trial, "id" | "name" | "branchConditions">
> & {
  id: ItemId;
  name: string;
  branches: ItemId[];
  defaultNextTrialId: ItemId | null;
  branchConditions: GraphRule[];
  createdAt?: string;
  updatedAt?: string;
  thenGoTo?: ModelRule[];
};
export type GraphLoop = Partial<Omit<Loop, "id" | "name" | "trials">> & {
  id: ItemId;
  name: string;
  trials: ItemId[];
  branches?: ItemId[];
  updatedAt?: string;
  exitBranchRoutes?: unknown;
  entryId?: string | null;
  nextId?: string | null;
  expanded?: boolean;
};
export type GraphDocument = {
  experimentID?: string;
  entryItemId?: ItemId | null;
  timeline: TimelineEntry[];
  trials: GraphTrial[];
  loops: GraphLoop[];
  updatedAt?: string;
};
export type WorkspaceSourceDocument = Omit<
  WorkspaceDocument,
  "trials" | "loops"
> & {
  trials: (Trial | GraphTrial)[];
  loops: (Loop | GraphLoop)[];
};
export type ModelRule = Omit<Partial<GraphRule>, "nextTrialId" | "id"> & {
  id: ItemId;
  targetId: string | null;
};
export type ModelTrial = Partial<
  Omit<
    Trial,
    | "id"
    | "name"
    | "parentLoopId"
    | "defaultNextTrialId"
    | "destinationOrder"
    | "branchConditions"
  >
> & {
  id: string;
  name: string;
  parentLoopId: string | null;
  defaultNextTrialId: string | null;
  destinationOrder?: string[];
  branchConditions?: GraphRule[];
  thenGoTo: ModelRule[];
};
export type ModelLoop = Partial<
  Omit<
    Loop,
    | "id"
    | "name"
    | "entryItemId"
    | "nextItemId"
    | "parentLoopId"
    | "repetitions"
  >
> & {
  id: string;
  name: string;
  parentLoopId: string | null;
  entryId: string | null;
  nextId: string | null;
  repetitions: number;
  expanded: boolean;
};
export type ModelItem = ModelTrial | ModelLoop;
export const isModelLoop = (item: ModelItem): item is ModelLoop =>
  "entryId" in item;
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
export type ModelConnection = Pair & {
  id: string;
  refs: Array<{ kind: string; id: ItemId }>;
};
export type StructureEndpoints = {
  entryId: string;
  exitId: string;
  ids: string[];
};
export type Fragment = {
  schema: "branching-workspace-fragment/1";
  trials: ModelTrial[];
  loops: ModelLoop[];
  scopeOrder: Record<string, string[]>;
  positions: Record<string, Point>;
};
export type PasteResult = { ids: string[]; idMap: Record<string, string> };
export type InsertionPlan = {
  sourceId: string;
  targetId: string;
  mode?: Placement;
  side?: "left" | "right";
};
export type InsertionResult = StructureEndpoints &
  Required<InsertionPlan> & { siblingIds: string[] | null };
export type LoopLevel = {
  scopeId: string | null;
  name: string;
  relation: "current" | "ancestor" | "root";
  branchCount: number;
};
export type LoopContext = {
  sourceId: string;
  targetId: string;
  scopeTrialId: string;
  looseTrialId: string;
  looseIds: string[];
  canPlaceDestination: boolean;
  levels: LoopLevel[];
};
export type LoopRequest = {
  sourceId: string;
  targetId?: string;
  previous?: Pair | null;
};
export type LoopSelection = { level: LoopLevel; requiresPlacement: boolean };
export type LoopPlan = {
  document: GraphDocument;
  source: GraphTrial;
  trial: GraphTrial;
  crossedLoopIds: ItemId[];
};
export type ScopeGraph = {
  direct: ModelItem[];
  unit: (id: string | null | undefined) => string | undefined;
  forward: Map<string, Set<string>>;
  reverse: Map<string, Set<string>>;
};
export type ModelLayout = { positions: Record<string, Point> };
export type Delta = {
  path: (string | number)[];
  hasBefore: boolean;
  hasAfter: boolean;
  before?: unknown;
  after?: unknown;
  indexBefore?: number;
  indexAfter?: number;
};
export type { WorkspaceCommand } from "./commandTypes.js";
