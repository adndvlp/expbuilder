import { own, required } from "./valueUtils.js";
import type {
  ItemId,
  GraphRule,
  GraphDocument,
  WorkspaceSourceDocument,
} from "./types.js";
export const FINISH = "FINISH_EXPERIMENT";
export function idKey(value: ItemId): string;
export function idKey(value: unknown): string | null;
export function idKey(value: unknown): string | null {
  return value == null ? null : String(value);
}
const isTarget = (value: ItemId | null | undefined): value is ItemId =>
  value != null && value !== FINISH;
const unique = (values: (ItemId | null | undefined)[]) => [
  ...new Map(values.filter(isTarget).map((id) => [idKey(id), id])).values(),
];

type NavigationTrial = {
  defaultPolicy?: "automatic" | "preserve-terminal";
  defaultNextTrialId?: ItemId | null;
  branchConditions?: GraphRule[];
  branches?: ItemId[];
  destinationOrder?: ItemId[];
};
export function normalizeNavigation<T extends NavigationTrial>(
  trial: T,
  { edited = false } = {},
): T {
  if (edited || !trial.defaultPolicy) trial.defaultPolicy = "automatic";
  trial.branchConditions ??= [];
  trial.branchConditions = trial.branchConditions.map((c) => ({
    ...c,
    kind: c.kind ?? "condition",
  }));
  const targets = unique([
    trial.defaultNextTrialId,
    ...trial.branchConditions.map((c) => c.nextTrialId),
  ]);
  const byId = new Map(targets.map((id) => [idKey(id), id]));
  trial.destinationOrder = unique([
    ...(trial.destinationOrder ?? []),
    ...targets,
  ])
    .filter((id) => byId.has(idKey(id)))
    .map((id) => required(byId.get(idKey(id))));
  if (
    trial.defaultPolicy !== "preserve-terminal" &&
    !isTarget(trial.defaultNextTrialId) &&
    targets.length
  )
    trial.defaultNextTrialId = trial.destinationOrder[0];
  trial.defaultNextTrialId ??= null;
  trial.branches = [...trial.destinationOrder];
  return trial;
}

export function deriveConnections(document: Pick<GraphDocument, "trials">) {
  const trials = new Map(document.trials.map((t) => [idKey(t.id), t])),
    result = new Map<
      string,
      {
        id: string;
        sourceId: ItemId;
        targetId: ItemId;
        refs: { kind: string; id: ItemId }[];
      }
    >();
  for (const t of document.trials) {
    const refs = [
      { kind: "default", id: "default", targetId: t.defaultNextTrialId },
      ...(t.branchConditions ?? []).map((c) => ({
        kind: c.kind ?? "condition",
        id: c.id,
        targetId: c.nextTrialId,
      })),
    ];
    for (const ref of refs) {
      const target = trials.get(idKey(ref.targetId) ?? "");
      if (!target) continue;
      const key = JSON.stringify([idKey(t.id), idKey(target.id)]);
      if (!result.has(key))
        result.set(key, {
          id: key,
          sourceId: t.id,
          targetId: target.id,
          refs: [],
        });
      required(result.get(key)).refs.push({ kind: ref.kind, id: ref.id });
    }
  }
  return [...result.values()];
}

export function convertWorkspace<T extends WorkspaceSourceDocument>(
  source: T,
): T {
  if (
    source.workspaceSchemaVersion != null &&
    ![1, 2].includes(source.workspaceSchemaVersion)
  )
    throw Object.assign(Error("Unsupported workspace version"), {
      status: 409,
      code: "WORKSPACE_SCHEMA_UNSUPPORTED",
    });
  const document = structuredClone(source),
    trials = new Map(document.trials.map((t) => [idKey(t.id), t]));
  const checkTarget = (id: ItemId | null | undefined) => {
    if (isTarget(id) && !trials.has(idKey(id)))
      throw Object.assign(new Error(`Invalid branch destination ${id}`), {
        status: 400,
        code: "BRANCH_TARGET_NOT_TRIAL",
      });
  };
  for (const t of document.trials) {
    if (
      !own(t, "defaultNextTrialId") ||
      !Array.isArray(t.branches) ||
      !Array.isArray(t.branchConditions)
    )
      throw Object.assign(
        new Error(
          "Explicit navigation is required before workspace conversion",
        ),
        { status: 400 },
      );
    const previous = unique(t.branches);
    for (const id of [
      ...previous,
      t.defaultNextTrialId,
      ...t.branchConditions.map((c) => c.nextTrialId),
    ])
      checkTarget(id);
    if (document.workspaceSchemaVersion !== 2) {
      t.branchConditions = t.branchConditions.map((c) => ({
        ...c,
        kind: c.kind ?? "condition",
      }));
      const represented = new Set(
        [
          t.defaultNextTrialId,
          ...t.branchConditions.map((c) => c.nextTrialId),
        ].map(idKey),
      );
      const used = new Set(t.branchConditions.map((c) => String(c.id)));
      let next = 1;
      for (const target of previous)
        if (!represented.has(idKey(target))) {
          while (used.has(String(next))) next++;
          t.branchConditions.push({
            id: next,
            kind: "route",
            rules: [],
            nextTrialId: target,
          });
          used.add(String(next++));
        }
      t.defaultPolicy =
        !isTarget(t.defaultNextTrialId) && previous.length
          ? "preserve-terminal"
          : "automatic";
      t.destinationOrder = previous;
    }
    normalizeNavigation(t);
  }
  document.workspaceSchemaVersion = 2;
  document.authoringRevision ??= String(document.updatedAt ?? "0");
  document.editorLayout ??= { positionsByItemId: {} };
  return document;
}
