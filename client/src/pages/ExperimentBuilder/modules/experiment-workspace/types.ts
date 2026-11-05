import type {
  WorkspaceDocument,
  Delta,
} from "../../../../../../shared/experiment-workspace/types";
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
