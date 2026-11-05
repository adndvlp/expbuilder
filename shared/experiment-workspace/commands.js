import { assertEdgePermission } from "./edgePermission.js";
import { convertWorkspace, idKey, normalizeNavigation } from "./navigation.js";
import { toModel, fromModel } from "./documentAdapter.js";
import { workspaceModel } from "./modelServices.js";
import { createUniqueItemName } from "./names.js";

const stringArgs = (args) =>
  Object.fromEntries(
    Object.entries(args).map(([k, v]) => [k, k.endsWith("Id") ? idKey(v) : v]),
  );

export function applyWorkspaceCommand(source, command, options = {}) {
  const document = convertWorkspace(source),
    s = toModel(document),
    a = stringArgs(command.args ?? {});
  if (a.previous)
    a.previous = {
      source: idKey(a.previous.source),
      target: idKey(a.previous.target),
    };
  if (a.endpoints)
    a.endpoints = {
      ...a.endpoints,
      entryId: idKey(a.endpoints.entryId),
      exitId: idKey(a.endpoints.exitId),
    };
  const M = workspaceModel({ ...options, endpoints: a.endpoints });
  for (const [id, position] of Object.entries(a.layoutBefore ?? {})) {
    if (
      !M.item(s, id) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    )
      throw Error("Invalid layout position");
    s.anchors[id] = { x: position.x, y: position.y };
  }
  assertEdgePermission(M, s, command.kind, a);
  const beforeModel = M.copy(s);
  const routingSources = new Set(
    [a.sourceId, a.newSourceId, a.previous?.source].filter(Boolean),
  );
  if (command.kind === "deleteItems")
    for (const e of M.connections(s))
      if (a.ids.map(idKey).includes(e.target)) routingSources.add(e.source);
  for (const id of routingSources) {
    const trial = M.realTrial(s, id);
    if (trial) trial.defaultPolicy = "automatic";
  }
  let result, copiedMap;
  const configureNew = (id, trial = {}) => {
    const t = M.realTrial(s, id);
    Object.assign(t, trial, {
      id,
      parentLoopId: t.parentLoopId,
      name: createUniqueItemName(document, trial.name, "New Trial"),
      defaultPolicy: "automatic",
    });
    return id;
  };
  switch (command.kind) {
    case "convertWorkspace":
      break;
    case "addTrial":
      result = configureNew(M.addTrial(s, a.position), a.trial);
      break;
    case "addChild":
      result = configureNew(
        Object.hasOwn(a, "scopeId")
          ? M.addLoopBranch(s, a.sourceId, a.scopeId, a.mode)
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
      if (context && !Object.hasOwn(a, "scopeId"))
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
            a.scopeId,
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
      const sourceId =
        command.kind === "reconnectSource" ? a.newSourceId : a.sourceId;
      const previous = {
        source: a.sourceId,
        target: command.kind === "reconnectTarget" ? a.oldTargetId : a.targetId,
      };
      const context = M.loopConnectionContext(
        s,
        sourceId,
        a.targetId,
        previous,
      );
      if (context && !Object.hasOwn(a, "scopeId"))
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
            a.scopeId,
            previous,
            a.mode,
          )
        : command.kind === "reconnectSource"
          ? M.reconnectSource(s, a.sourceId, a.targetId, a.newSourceId)
          : M.reconnectTarget(s, a.sourceId, a.oldTargetId, a.targetId);
      break;
    }
    case "deleteItems":
      result = M.deleteItems(s, a.ids.map(idKey));
      break;
    case "groupLoop": {
      result = M.groupLoop(
        s,
        a.ids.map(idKey),
        createUniqueItemName(document, a.name, "Loop"),
      );
      const config = { ...(a.loop ?? {}) };
      for (const key of [
        "id",
        "trials",
        "parentLoopId",
        "entryItemId",
        "nextItemId",
      ])
        delete config[key];
      Object.assign(M.item(s, result), config);
      const reference = a.ids
        .map(idKey)
        .map((id) => s.anchors[id])
        .find(Boolean);
      if (reference) s.anchors[result] = { ...reference };
      break;
    }
    case "reorderRoot": {
      const roots = M.members(s, null).map((i) => i.id),
        ids = a.ids.map(idKey);
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
      else M.moveComponent(s, a.itemId, a.dx, a.dy);
      break;
    }
    case "updateTrial": {
      const t = M.realTrial(s, a.trialId);
      if (!t) throw Error("Trial not found");
      const nav = ["branchConditions", "defaultNextTrialId"].some((k) =>
        Object.hasOwn(a.updates, k),
      );
      const updates = structuredClone(a.updates);
      delete updates.id;
      delete updates.branches;
      if (Object.hasOwn(updates, "defaultNextTrialId"))
        updates.defaultNextTrialId = idKey(updates.defaultNextTrialId);
      if (updates.branchConditions) {
        updates.thenGoTo = updates.branchConditions.map(
          ({ nextTrialId, ...r }) => ({
            ...r,
            kind: r.kind ?? "condition",
            targetId: idKey(nextTrialId),
          }),
        );
        delete updates.branchConditions;
      }
      const targets = [
        updates.defaultNextTrialId,
        ...(updates.thenGoTo ?? []).map((r) => r.targetId),
      ];
      if (
        targets.some(
          (id) => id != null && id !== M.FINISH && !M.realTrial(s, id),
        )
      )
        throw Error("Invalid branch destination");
      Object.assign(t, updates);
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
      ])
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
      throw Object.assign(Error(`Unknown workspace command ${command.kind}`), {
        status: 400,
      });
  }
  M.reconcileGraph(s, beforeModel);
  const next = fromModel(s, document, options);
  if (copiedMap) {
    const remap = (id) =>
      copiedMap[idKey(id)] ? next.idMap[copiedMap[idKey(id)]] : id;
    for (const temp of Object.values(copiedMap)) {
      const t = [...next.document.trials, ...next.document.loops].find(
        (t) => idKey(t.id) === idKey(next.idMap[temp]),
      );
      for (const c of [
        ...(t.paramsOverride ?? []),
        ...(t.loopConditions ?? []),
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

export function copyWorkspaceItems(source, ids, options = {}) {
  const s = toModel(convertWorkspace(source)),
    M = workspaceModel(options),
    fragment = M.copyItems(s, ids.map(idKey));
  if (!fragment) return null;
  const copied = new Set(
    [...fragment.trials, ...fragment.loops].map((i) => i.id),
  );
  for (const trial of fragment.trials) {
    const original = M.realTrial(s, trial.id);
    if (
      original.csvFromLoop &&
      original.parentLoopId &&
      !copied.has(original.parentLoopId)
    ) {
      const parent = M.item(s, original.parentLoopId);
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
      ])
        if (parent[key] !== undefined)
          trial[key] = structuredClone(parent[key]);
    }
  }
  return fragment;
}
