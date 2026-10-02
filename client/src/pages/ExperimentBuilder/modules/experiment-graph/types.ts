export type GraphScopeId = string | null;

type TimelineItemBase = {
  id: string | number;
  name: string;
  parentLoopId?: string | null;
};

export type TrialTimelineItem = TimelineItemBase & {
  type: "trial";
  branches?: (string | number)[];
  trials?: never;
};

export type LoopTimelineItem = TimelineItemBase & {
  type: "loop";
  trials?: (string | number)[];
  branches?: never;
  branchConditions?: never;
};

export type TimelineItem = TrialTimelineItem | LoopTimelineItem;

export type GraphBranchEdge = {
  sourceId: string | number;
  targetId: string | number;
  sourceOwnerId: GraphScopeId;
  targetOwnerId: GraphScopeId;
  exitedLoopIds: string[];
};

export type GraphScopeView = {
  scopeId: GraphScopeId;
  parentScopeId: GraphScopeId;
  items: TimelineItem[];
};

export type GraphDiagnostic = {
  code: string;
  itemId?: string | number;
  sourceId?: string | number;
  targetId?: string | number;
};

export type ExperimentGraphSnapshot = {
  revision: string;
  root: GraphScopeView;
  scopes: Record<string, GraphScopeView>;
  edges: GraphBranchEdge[];
  diagnostics: GraphDiagnostic[];
};
