import type {
  WorkspaceCommand,
  CommandOptions,
  CommandResponse,
  CommandResults,
} from "./commandTypes.js";
import type { WorkspaceSourceDocument, ItemId, ModelTrial } from "./types.js";
import type { Trial } from "./records.js";
import { normalizeCommand } from "./normalizeCommand.js";
import { own, required } from "./valueUtils.js";
import { assertEdgePermission } from "./edgePermission.js";
import { convertWorkspace, idKey, normalizeNavigation } from "./navigation.js";
import { toModel, fromModel } from "./documentAdapter.js";
import { workspaceModel } from "./modelServices.js";
import { createUniqueItemName } from "./names.js";

export function applyWorkspaceCommand<C extends WorkspaceCommand>(
  source: WorkspaceSourceDocument,
  command: C,
  options?: CommandOptions,
): CommandResponse<C>;
export function applyWorkspaceCommand(
  source: WorkspaceSourceDocument,
  command: WorkspaceCommand,
  options: CommandOptions = {},
) {
  const document = convertWorkspace(source),
    s = toModel(document);
  const normalized = normalizeCommand(command);
  const { kind, args: a } = normalized;
  const M = workspaceModel({
    ...options,
    endpoints: "endpoints" in a ? a.endpoints : undefined,
  });
  for (const [id, position] of Object.entries(a.layoutBefore ?? {})) {
    if (
      !M.item(s, id) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    )
      throw Error("Invalid layout position");
    s.anchors[id] = { x: position.x, y: position.y };
  }
  assertEdgePermission(M, s, normalized);
  const beforeModel = M.copy(s);
  const routingSources = new Set(
    [
      "sourceId" in a ? a.sourceId : null,
      "newSourceId" in a ? a.newSourceId : null,
      "previous" in a ? a.previous?.source : null,
    ].filter((id): id is string => !!id),
  );
  if (kind === "deleteItems")
    for (const e of M.connections(s))
      if (a.ids.map((id) => idKey(id)).includes(e.target))
        routingSources.add(e.source);
  for (const id of routingSources) {
    const trial = M.realTrial(s, id);
    if (trial) trial.defaultPolicy = "automatic";
  }
  let result: CommandResults[keyof CommandResults] | void,
    copiedMap: Record<string, string> | undefined;
  const configureNew = (id: string, trial: Partial<Trial> = {}) => {
    const t = required(M.realTrial(s, id));
    Object.assign(t, trial, {
      id,
      parentLoopId: t.parentLoopId,
      name: createUniqueItemName(document, trial.name, "New Trial"),
      defaultPolicy: "automatic",
    });
    return id;
  };
  switch (kind) {
    case "convertWorkspace":
      break;
    case "addTrial":
      result = configureNew(M.addTrial(s, a.position), a.trial);
      break;
    case "addChild":
      result = configureNew(
        own(a, "scopeId")
          ? M.addLoopBranch(s, a.sourceId, a.scopeId ?? null, a.mode)
          : M.addChild(s, a.sourceId, a.mode),
      );
      break;
    case "connect": {
      const context = M.loopConnectionContext(
        s,
        a.sourceId,
        a.targetId,
        a.previous,
      );
      if (context && !own(a, "scopeId"))
        throw Object.assign(Error("Choose a loop level"), {
          status: 409,
          code: "BRANCH_LEVEL_REQUIRED",
          levels: context.levels,
        });
      if (
        a.previous &&
        (a.sourceId !== a.previous.source) ===
          (a.targetId !== a.previous.target)
      )
        throw Error("Reconnect exactly one endpoint");
      result = context
        ? M.connectAtLoopLevel(
            s,
            a.sourceId,
            a.targetId,
            a.scopeId ?? null,
            a.previous,
            a.mode,
          )
        : a.previous
          ? a.sourceId !== a.previous.source
            ? M.reconnectSource(
                s,
                a.previous.source,
                a.previous.target,
                a.sourceId,
              )
            : M.reconnectTarget(
                s,
                a.previous.source,
                a.previous.target,
                a.targetId,
              )
          : M.connect(s, a.sourceId, a.targetId);
      break;
    }
    case "removeConnection":
      result = M.removeConnection(s, a.sourceId, a.targetId);
      break;
    case "reconnectTarget":
    case "reconnectSource": {
      const sourceId = kind === "reconnectSource" ? a.newSourceId : a.sourceId;
      const previous = {
        source: a.sourceId,
        target: kind === "reconnectTarget" ? a.oldTargetId : a.targetId,
      };
      const context = M.loopConnectionContext(
        s,
        sourceId,
        a.targetId,
        previous,
      );
      if (context && !own(a, "scopeId"))
        throw Object.assign(Error("Choose a loop level"), {
          status: 409,
          code: "BRANCH_LEVEL_REQUIRED",
          levels: context.levels,
        });
      result = context
        ? M.connectAtLoopLevel(
            s,
            sourceId,
            a.targetId,
            a.scopeId ?? null,
            previous,
            a.mode,
          )
        : kind === "reconnectSource"
          ? M.reconnectSource(s, a.sourceId, a.targetId, a.newSourceId)
          : M.reconnectTarget(s, a.sourceId, a.oldTargetId, a.targetId);
      break;
    }
    case "deleteItems":
      result = M.deleteItems(
        s,
        a.ids.map((id) => idKey(id)),
      );
      break;
    case "groupLoop": {
      result = M.groupLoop(
        s,
        a.ids.map((id) => idKey(id)),
        createUniqueItemName(document, a.name, "Loop"),
      );
      const config = { ...(a.loop ?? {}) };
      for (const key of [
        "id",
        "trials",
        "parentLoopId",
        "entryItemId",
        "nextItemId",
      ] as const)
        delete config[key];
      Object.assign(required(M.item(s, result)), config);
      const reference = a.ids
        .map((id) => idKey(id))
        .map((id) => s.anchors[id])
        .find(Boolean);
      if (reference) s.anchors[result] = { ...reference };
      break;
    }
    case "reorderRoot": {
      const roots = M.members(s, null).map((i) => i.id),
        ids = a.ids.map((id) => idKey(id));
      if (
        ids.length !== roots.length ||
        new Set(ids).size !== roots.length ||
        ids.some((id) => !roots.includes(id))
      )
        throw Error("Invalid root ordering");
      s.scopeOrder.root = ids;
      break;
    }
    case "deleteLoop":
      result = M.deleteLoop(s, a.loopId);
      break;
    case "insertStructure":
      result = M.insertStructure(s, a.itemId, a);
      break;
    case "moveGroup": {
      const group = M.componentFor(s, a.itemId);
      if (!group || group.locked)
        throw Error("The active structure cannot be freely moved");
      if (a.anchors)
        for (const [id, position] of Object.entries(a.anchors)) {
          if (
            !group.ids.has(id) ||
            !Number.isFinite(position.x) ||
            !Number.isFinite(position.y)
          )
            throw Error("Invalid group position");
          s.anchors[id] = { ...position };
        }
      else
        M.moveComponent(
          s,
          a.itemId,
          required(a.dx, "Invalid group position"),
          required(a.dy, "Invalid group position"),
        );
      break;
    }
    case "updateTrial": {
      const t = M.realTrial(s, a.trialId);
      if (!t) throw Error("Trial not found");
      const nav = ["branchConditions", "defaultNextTrialId"].some((k) =>
        own(a.updates, k),
      );
      const updates = structuredClone(a.updates);
      const navigationUpdates: Partial<ModelTrial> = {};
      delete updates.id;
      delete updates.branches;
      if (own(updates, "defaultNextTrialId"))
        navigationUpdates.defaultNextTrialId = idKey(
          updates.defaultNextTrialId,
        );
      if (updates.branchConditions) {
        navigationUpdates.thenGoTo = updates.branchConditions.map(
          ({ nextTrialId, ...r }) => ({
            ...r,
            kind: r.kind ?? "condition",
            targetId: idKey(nextTrialId),
          }),
        );
        delete updates.branchConditions;
      }
      const targets = [
        navigationUpdates.defaultNextTrialId,
        ...(navigationUpdates.thenGoTo ?? []).map((r) => r.targetId),
      ];
      if (
        targets.some(
          (id) => id != null && id !== M.FINISH && !M.realTrial(s, id),
        )
      )
        throw Error("Invalid branch destination");
      Object.assign(t, updates, navigationUpdates);
      if (nav) t.defaultPolicy = "automatic";
      break;
    }
    case "updateLoop": {
      const loop = s.loops.find((l) => l.id === a.loopId);
      if (!loop) throw Error("Loop not found");
      const updates = structuredClone(a.updates);
      for (const key of [
        "id",
        "trials",
        "parentLoopId",
        "entryItemId",
        "nextItemId",
      ] as const)
        delete updates[key];
      Object.assign(loop, updates);
      break;
    }
    case "pasteItems": {
      result = M.pasteItems(s, a.fragment, a.offset);
      copiedMap = result.idMap;
      break;
    }
    default:
      throw Object.assign(Error(`Unknown workspace command ${kind}`), {
        status: 400,
      });
  }
  M.reconcileGraph(s, beforeModel);
  const next = fromModel(s, document, options);
  if (copiedMap) {
    const copied = copiedMap;
    const remap = (id: ItemId) =>
      copied[idKey(id)] ? next.idMap[copied[idKey(id)]] : id;
    for (const temp of Object.values(copiedMap)) {
      const t = required(
        [...next.document.trials, ...next.document.loops].find(
          (t) => idKey(t.id) === idKey(next.idMap[temp]),
        ),
      );
      for (const c of [
        ...("paramsOverride" in t ? (t.paramsOverride ?? []) : []),
        ...("loopConditions" in t ? (t.loopConditions ?? []) : []),
      ])
        for (const r of c.rules) r.trialId = remap(r.trialId);
    }
  }
  for (const t of next.document.trials) normalizeNavigation(t);
  return {
    ...next,
    result:
      typeof result === "string" && next.idMap[result] !== undefined
        ? next.idMap[result]
        : result,
  };
}

export function copyWorkspaceItems(
  source: WorkspaceSourceDocument,
  ids: ItemId[],
  options: CommandOptions = {},
) {
  const s = toModel(convertWorkspace(source)),
    M = workspaceModel(options),
    fragment = M.copyItems(
      s,
      ids.map((id) => idKey(id)),
    );
  if (!fragment) return null;
  const copied = new Set(
    [...fragment.trials, ...fragment.loops].map((i) => i.id),
  );
  for (const trial of fragment.trials) {
    const original = required(M.realTrial(s, trial.id));
    if (
      original.csvFromLoop &&
      original.parentLoopId &&
      !copied.has(original.parentLoopId)
    ) {
      const parent = required(
        s.loops.find((l) => l.id === original.parentLoopId),
      );
      trial.csvFromLoop = false;
      for (const key of [
        "csvJson",
        "csvColumns",
        "orders",
        "stimuliOrders",
        "orderColumns",
        "categories",
        "categoryColumn",
        "categoryData",
      ] as const)
        if (parent[key] !== undefined)
          Object.assign(trial, { [key]: structuredClone(parent[key]) });
    }
  }
  return fragment;
}
