import type { Trial, Loop } from "./records.js";
import type {
  ItemId,
  Point,
  Placement,
  Fragment,
  PasteResult,
  InsertionResult,
  WorkspaceDocument,
  WorkspaceSourceDocument,
} from "./types.js";
import type { WorkspaceModelOptions } from "./modelContracts.js";
export type CommandMetadata = { expectedRevision?: string };
export type CommandEndpoints<I extends ItemId> = {
  entryId: I;
  exitId: I;
  ids?: I[];
};
export type CommonArgs = {
  layoutBefore?: Record<string, Point>;
  edgeRefs?: string[];
};
export type CommandArgs<I extends ItemId = ItemId> = {
  convertWorkspace: CommonArgs;
  addTrial: CommonArgs & { position?: Point; trial?: Partial<Trial> };
  addChild: CommonArgs & {
    sourceId: I;
    scopeId?: string | null;
    mode?: Placement;
  };
  connect: CommonArgs & {
    sourceId: I;
    targetId: I;
    scopeId?: string | null;
    mode?: Placement;
    endpoints?: CommandEndpoints<I>;
    previous?: { source: I; target: I };
  };
  removeConnection: CommonArgs & { sourceId: I; targetId: I };
  reconnectTarget: CommonArgs & {
    sourceId: I;
    oldTargetId: I;
    targetId: I;
    scopeId?: string | null;
    mode?: Placement;
  };
  reconnectSource: CommonArgs & {
    sourceId: I;
    targetId: I;
    newSourceId: I;
    scopeId?: string | null;
    mode?: Placement;
  };
  deleteItems: CommonArgs & { ids: I[] };
  groupLoop: CommonArgs & { ids: I[]; name?: string; loop?: Partial<Loop> };
  reorderRoot: CommonArgs & { ids: I[] };
  deleteLoop: CommonArgs & { loopId: I };
  insertStructure: CommonArgs & {
    itemId: I;
    sourceId: I;
    targetId: I;
    mode?: Placement;
    side?: "left" | "right";
    endpoints?: { entryId: I; exitId: I; ids?: I[] };
  };
  moveGroup: CommonArgs & {
    itemId: I;
    anchors?: Record<string, Point>;
    dx?: number;
    dy?: number;
  };
  updateTrial: CommonArgs & { trialId: I; updates: Partial<Trial> };
  updateLoop: CommonArgs & { loopId: I; updates: Partial<Loop> };
  pasteItems: CommonArgs & { fragment: Fragment; offset?: Point };
};
export type CommandKind = keyof CommandArgs;
export type WorkspaceCommand = {
  [K in CommandKind]: CommandMetadata & {
    kind: K;
  } & (K extends "convertWorkspace"
      ? { args?: CommandArgs[K] }
      : { args: CommandArgs[K] });
}[CommandKind];
export type NormalizedCommand = {
  [K in CommandKind]: { kind: K; args: CommandArgs<string>[K] };
}[CommandKind];
export type CommandResults = {
  convertWorkspace: undefined;
  addTrial: ItemId;
  addChild: ItemId;
  connect: ItemId;
  removeConnection: undefined;
  reconnectTarget: string;
  reconnectSource: string;
  deleteItems: undefined;
  groupLoop: ItemId;
  reorderRoot: undefined;
  deleteLoop: undefined;
  insertStructure: InsertionResult;
  moveGroup: undefined;
  updateTrial: undefined;
  updateLoop: undefined;
  pasteItems: PasteResult;
};
export type CommandResponse<C extends WorkspaceCommand> = {
  document: WorkspaceDocument;
  idMap: Record<string, ItemId>;
  result: CommandResults[C["kind"]];
};
export type CommandOptions = WorkspaceModelOptions & {
  allocateId?: (
    kind: "trial" | "loop",
    document: WorkspaceSourceDocument,
  ) => ItemId | undefined;
};
