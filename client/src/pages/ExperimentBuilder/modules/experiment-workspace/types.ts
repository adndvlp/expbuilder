import type {
  WorkspaceDocument,
  Delta,
} from "../../../../../../shared/experiment-workspace/dist/types.js";
import type { ExperimentGraphSnapshot } from "../experiment-graph/types";
export type { WorkspaceDocument, Delta };
export type WorkspaceResponse = {
  success: true;
  revision: string;
  document: WorkspaceDocument;
  graph: ExperimentGraphSnapshot;
  result?: unknown;
  idMap?: Record<string, string | number>;
  removedIds?: (string | number)[];
  undoPatch?: Delta[];
};

export type WorkspaceCommandResponse<
  K extends
    import("../../../../../../shared/experiment-workspace/dist/commandTypes.js").CommandKind,
> = Omit<WorkspaceResponse, "result"> & {
  result: import("../../../../../../shared/experiment-workspace/dist/commandTypes.js").CommandResults[K];
};
