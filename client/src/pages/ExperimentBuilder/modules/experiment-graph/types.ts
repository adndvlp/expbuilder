export type GraphScopeId = string | null;

export type TimelineItem = {
  id: string | number;
  type: "trial" | "loop";
  name: string;
  branches?: (string | number)[];
  trials?: (string | number)[];
  parentLoopId?: string | null;
};

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
