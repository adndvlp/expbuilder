import type {
  ItemId,
  Point,
  Placement,
  Pair,
  ModelState,
  ModelTrial,
  ModelLoop,
  ModelItem,
  ModelConnection,
  ModelComponent,
  ScopeGraph,
  StructureEndpoints,
  Fragment,
  PasteResult,
  InsertionPlan,
  InsertionResult,
  LoopLevel,
  LoopContext,
  LoopRequest,
  LoopSelection,
  LoopPlan,
  ModelLayout,
} from "./types.js";
import type { createUniqueItemName } from "./names.js";
export type ModelServices = {
  createUniqueItemName: typeof createUniqueItemName;
  layout: (state: ModelState) => ModelLayout;
  insertionEndpoints: (
    state: ModelState,
    id: string,
    entryId?: string,
  ) => StructureEndpoints | null;
  loopBranchLevels: (
    state: ModelState,
    sourceId: string,
    contextId?: string,
  ) => LoopLevel[];
  selectLoopBranchLevel: (
    context: { levels: LoopLevel[] },
    scopeId: string | null,
  ) => LoopSelection | null;
  planLoopBranch: (
    state: ModelState,
    sourceId: string,
    scopeId: string | null,
    mode: Placement,
  ) => LoopPlan;
};
export type WorkspaceModelOptions = Partial<
  Pick<ModelServices, "layout" | "insertionEndpoints">
> & {
  endpoints?: Pick<StructureEndpoints, "entryId" | "exitId">;
};
type Id = string | null | undefined;
export interface ModelInternals {
  FINISH: "FINISH_EXPERIMENT";
  copy<T>(value: T): T;
  trial(
    id: ItemId,
    name: string,
    parentLoopId?: string | null,
    defaultNextTrialId?: string | null,
  ): ModelTrial;
  makeState(
    name: string,
    trials?: ModelTrial[],
    loops?: ModelLoop[],
    entryId?: string | null,
  ): ModelState;
  item(state: ModelState, id: Id): ModelItem | undefined;
  realTrial(state: ModelState, id: Id): ModelTrial | undefined;
  uniqueId(state: ModelState, prefix: string): string;
  members(state: ModelState, loopId: string | null): ModelItem[];
  ancestors(state: ModelState, item: ModelItem | undefined): ModelLoop[];
  resolve(state: ModelState, id: Id, seen?: Set<string>): string | null;
  connections(state: ModelState): ModelConnection[];
  reachable(state: ModelState): { trials: Set<string>; loops: Set<string> };
  components(state: ModelState): ModelComponent[];
  componentFor(state: ModelState, id: Id): ModelComponent | undefined;
  leafTrials(state: ModelState, id: Id): ModelTrial[];
  loopScopeGraph(state: ModelState, loop: ModelLoop): ScopeGraph;
  scopeReachable(graph: ScopeGraph, entry: Id): Set<string>;
  reconcileLoops(state: ModelState): void;
  setDefault(state: ModelState, id: string, targetId: string | null): void;
  adopt(state: ModelState, sourceId: string, targetId: Id): void;
  addDestination(
    state: ModelState,
    trial: ModelTrial,
    targetId: string,
  ): ItemId;
  connect(state: ModelState, sourceId: string, targetId: string): ItemId;
  setThen(
    state: ModelState,
    id: string,
    ruleId: ItemId,
    targetId: string | null,
  ): void;
  removeThen(state: ModelState, id: string, ruleId: ItemId): void;
  removeConnection(state: ModelState, sourceId: string, targetId: string): void;
  reconnectTarget(
    state: ModelState,
    sourceId: string,
    oldTargetId: string,
    targetId: string,
    adoptTarget?: boolean,
  ): string;
  reconnectSource(
    state: ModelState,
    sourceId: string,
    targetId: string,
    newSourceId: string,
    adoptTarget?: boolean,
  ): string;
  insertStructure(
    state: ModelState,
    itemId: string,
    plan: InsertionPlan,
  ): InsertionResult;
  deleteTrial(state: ModelState, id: string): void;
  deleteLoop(state: ModelState, id: string): void;
  deleteItems(state: ModelState, ids: string[]): void;
  addTrial(state: ModelState, position?: Point): string;
  addChild(state: ModelState, parentId: string, mode?: Placement): string;
  groupLoop(state: ModelState, ids: string[], name?: string): string;
  normalizeConnection(
    state: ModelState,
    a: string,
    ha: string,
    b: string,
    hb: string,
  ): Pair | null;
  entryOrder(
    state: ModelState,
    ids: Set<string>,
    unit?: (id: Id) => Id,
  ): string[];
  sourceHeads(order: string[], reverse: Map<string, Set<string>>): string[];
  prefixHeads(state: ModelState, entry: string): string[];
  remainingStart(state: ModelState): string | null;
  survivingContinuation(state: ModelState, before: ModelState): string | null;
  reconcileGraph(state: ModelState, before?: ModelState): ModelState;
  editGraph<A extends unknown[], R>(
    state: ModelState,
    command: (state: ModelState, ...args: A) => R,
    ...args: A
  ): R;
  loopBranchLevels(
    state: ModelState,
    sourceId: string,
    scopeTrialId?: string,
  ): LoopLevel[];
  loopConnectionContext(
    state: ModelState,
    sourceId: string,
    targetId: string,
    previous?: Pair | null,
  ): LoopContext | null;
  loopBranchSelection(
    state: ModelState,
    request: LoopRequest,
    scopeId: string | null,
  ): LoopSelection | null;
  connectAtLoopLevel(
    state: ModelState,
    sourceId: string,
    targetId: string,
    scopeId: string | null,
    previous?: Pair | null,
    mode?: Placement,
  ): string;
  applyLoopBranchPlan(
    state: ModelState,
    plan: LoopPlan,
    options?: {
      targetId?: string | null;
      exitId?: string | null;
      roots?: string[];
    },
  ): string;
  addLoopBranch(
    state: ModelState,
    sourceId: string,
    scopeId: string | null,
    mode?: Placement,
  ): string;
  layout(state: ModelState): ModelLayout;
  moveComponent(state: ModelState, id: string, dx: number, dy: number): void;
  copyItems(state: ModelState, ids: string[]): Fragment | null;
  pasteItems(
    state: ModelState,
    fragment: Fragment,
    offset?: Point,
  ): PasteResult;
  compile(state: ModelState): {
    schema: string;
    name: string;
    entryId: string | null;
    trials: ModelTrial[];
    loops: Omit<ModelLoop, "expanded">[];
  };
  serialize(state: ModelState): string;
  restore(json: string): ModelState;
}
