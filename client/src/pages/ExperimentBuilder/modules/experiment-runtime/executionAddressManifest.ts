import type { ExperimentGraphSnapshot } from "../experiment-graph/types";
import type { ExecutionAddress } from "./jumpRequest";

export type ExecutionAddressManifest = {
  version: 2;
  revision: string;
  nextBySource: Record<string, string>;
  addressesByTarget: Record<string, ExecutionAddress>;
};

const idKey = (value: string | number) => String(value);

function buildOwnerPath(
  graph: ExperimentGraphSnapshot,
  ownerId: string | null,
): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  let current = ownerId;
  while (current !== null) {
    if (visited.has(current)) {
      throw new Error(`Execution scope ancestry contains a cycle at ${current}`);
    }
    visited.add(current);
    const scope = graph.scopes[current];
    if (!scope) {
      throw new Error(`Execution scope ${current} is missing`);
    }
    path.unshift(current);
    current = scope.parentScopeId;
  }
  return path;
}

function buildAddressesByTarget(
  graph: ExperimentGraphSnapshot,
): Record<string, ExecutionAddress> {
  const addresses: Record<string, ExecutionAddress> = {};
  const scopes = [graph.root, ...Object.values(graph.scopes)];
  for (const scope of scopes) {
    const targetOwnerId = scope.scopeId;
    const enterLoopIds = buildOwnerPath(graph, targetOwnerId);
    for (const item of scope.items) {
      const key = idKey(item.id);
      if (addresses[key]) {
        throw new Error(`Execution target ${key} has multiple owners`);
      }
      addresses[key] = {
        targetId: item.id,
        targetKind: item.type,
        targetOwnerId,
        enterLoopIds: [...enterLoopIds],
      };
    }
  }
  return addresses;
}

export function buildExecutionAddressManifest(
  graph: ExperimentGraphSnapshot,
): ExecutionAddressManifest {
  const rootBranchTargets = new Set(
    graph.edges
      .filter((edge) => edge.targetOwnerId === null)
      .map((edge) => idKey(edge.targetId)),
  );
  const sequentialItems = graph.root.items.filter(
    (item) => !rootBranchTargets.has(idKey(item.id)),
  );
  const nextBySource: Record<string, string> = {};

  sequentialItems.forEach((item, index) => {
    if (item.type !== "trial") return;
    const next = sequentialItems[index + 1];
    if (next) nextBySource[idKey(item.id)] = idKey(next.id);
  });

  return {
    version: 2,
    revision: graph.revision,
    nextBySource,
    addressesByTarget: buildAddressesByTarget(graph),
  };
}

export function generateExecutionAddressManifestCode(
  graph: ExperimentGraphSnapshot,
): string {
  const manifest = buildExecutionAddressManifest(graph);
  return `
window.ExpBuilderExecutionAddresses = Object.freeze(
  ${JSON.stringify(manifest)}
);
`;
}
