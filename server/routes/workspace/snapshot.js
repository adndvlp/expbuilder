import { buildExperimentGraph } from "../timeline/graph/buildExperimentGraph.js";

export const revisionOf = (doc) =>
  String(doc.authoringRevision ?? doc.updatedAt ?? doc.createdAt ?? "legacy");
export function workspaceSnapshot(document) {
  return {
    success: true,
    revision: revisionOf(document),
    document: structuredClone(document),
    graph: {
      ...buildExperimentGraph(document),
      revision: revisionOf(document),
    },
  };
}
