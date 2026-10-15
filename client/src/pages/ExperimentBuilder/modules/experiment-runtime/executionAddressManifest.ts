import type { ExperimentGraphSnapshot } from "../experiment-graph/types";
import type { ExecutionAddress } from "./executionAddress";

export type ExecutionAddressManifest = {
  version: 3;
  revision: string;
  nextBySource: Record<string, string>;
  entries: Record<string, string | null>;
  loopContinuations: Record<string, string | null>;
  addressesByTarget: Record<string, ExecutionAddress>;
  scopes: Record<string, string[]>;
  allScopes: Record<string, string[]>;
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
      throw new Error(
        `Execution scope ancestry contains a cycle at ${current}`,
      );
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
  const scopes = [graph.root, ...Object.values(graph.scopes)];
  return {
    version: 3,
    revision: graph.revision,
    nextBySource: Object.fromEntries(
      scopes.flatMap((scope) =>
        scope.items
          .filter(
            (item) => item.type === "trial" && item.defaultNextTrialId != null,
          )
          .flatMap((item) =>
            item.type === "trial"
              ? [[idKey(item.id), String(item.defaultNextTrialId)]]
              : [],
          ),
      ),
    ),
    addressesByTarget: buildAddressesByTarget(graph),
    entries: Object.fromEntries(
      scopes.map((scope) => [
        scope.scopeId ?? "root",
        scope.entryItemId == null ? null : String(scope.entryItemId),
      ]),
    ),
    loopContinuations: Object.fromEntries(
      scopes.flatMap((scope) =>
        scope.items
          .filter((item) => item.type === "loop")
          .map((item) => [
            idKey(item.id),
            item.nextItemId == null ? null : String(item.nextItemId),
          ]),
      ),
    ),
    scopes: Object.fromEntries(
      scopes.map((scope) => [
        scope.scopeId ?? "root",
        scope.items.map((item) => idKey(item.id)),
      ]),
    ),
    allScopes: Object.fromEntries(
      scopes.map((scope) => [
        scope.scopeId ?? "root",
        scope.items.map((item) => idKey(item.id)),
      ]),
    ),
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
