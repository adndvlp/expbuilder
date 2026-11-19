import { required } from "../valueUtils.js";
import type { ModelRule } from "../types.js";
import type { ModelInternals, ModelServices } from "../modelContracts.js";
export function create(api: () => ModelInternals, services: ModelServices) {
  const setDefault: ModelInternals["setDefault"] = (s, id, targetId) => {
    const t = api().realTrial(s, id);
    if (!t) throw Error("Source must be a trial");
    if (targetId && targetId !== api().FINISH && !api().realTrial(s, targetId))
      throw Error("Destination must be a trial");
    api().adopt(s, id, targetId);
    t.defaultNextTrialId = targetId;
  };
  const adopt: ModelInternals["adopt"] = (s, sourceId, targetId) => {
    const source = api().realTrial(s, sourceId),
      target = api().realTrial(s, targetId);
    if (!source || !target || !source.parentLoopId) return;
    const c = api().componentFor(s, target.id);
    if (!c || c.locked || c.ids.has(source.id)) return;
    for (const id of c.ids) {
      const i = required(api().item(s, id));
      if (i.parentLoopId === null) i.parentLoopId = source.parentLoopId;
    }
  };
  const addDestination: ModelInternals["addDestination"] = (s, t, targetId) => {
    const outgoing = api()
        .connections(s)
        .filter((e) => e.source === t.id),
      existing = outgoing.find((e) => e.target === targetId);
    if (existing) return existing.refs[0].id;
    if (!outgoing.length) {
      t.defaultNextTrialId = targetId;
      return "default";
    }
    const rule: ModelRule = {
      id: api().uniqueId(s, "condition"),
      targetId,
      kind: "route",
      rules: [],
    };
    t.thenGoTo.push(rule);
    return rule.id;
  };
  const connect: ModelInternals["connect"] = (s, sourceId, targetId) => {
    const t = api().realTrial(s, sourceId);
    if (!t || !api().realTrial(s, targetId))
      throw Error("Both endpoints must be real trials");
    api().adopt(s, sourceId, targetId);
    return api().addDestination(s, t, targetId);
  };
  const setThen: ModelInternals["setThen"] = (s, id, ruleId, targetId) => {
    const t = api().realTrial(s, id),
      r = t?.thenGoTo.find((r) => r.id === ruleId);
    if (!r) throw Error("Rule not found");
    if (targetId && targetId !== api().FINISH && !api().realTrial(s, targetId))
      throw Error("Destination must be a trial");
    api().adopt(s, id, targetId);
    r.targetId = targetId;
  };
  const removeThen: ModelInternals["removeThen"] = (s, id, ruleId) => {
    const t = required(api().realTrial(s, id));
    t.thenGoTo = t.thenGoTo.filter((r) => r.id !== ruleId);
  };
  const removeConnection: ModelInternals["removeConnection"] = (
    s,
    sourceId,
    targetId,
  ) => {
    const t = api().realTrial(s, sourceId);
    if (!t) return;
    if (t.defaultNextTrialId === targetId) t.defaultNextTrialId = null;
    t.thenGoTo = t.thenGoTo.filter((r) => r.targetId !== targetId);
  };
  const reconnectTarget: ModelInternals["reconnectTarget"] = (
    s,
    sourceId,
    oldTargetId,
    targetId,
    adoptTarget = true,
  ) => {
    const source = api().realTrial(s, sourceId);
    if (!source || !api().realTrial(s, targetId))
      throw Error("Los extremos deben ser trials reales");
    if (
      !api()
        .connections(s)
        .some((e) => e.source === sourceId && e.target === oldTargetId)
    )
      throw Error("Conexión no encontrada");
    if (oldTargetId === targetId) return JSON.stringify([sourceId, targetId]);
    if (adoptTarget) api().adopt(s, sourceId, targetId);
    if (source.defaultNextTrialId === oldTargetId)
      source.defaultNextTrialId = targetId;
    for (const rule of source.thenGoTo)
      if (rule.targetId === oldTargetId) rule.targetId = targetId;
    if (source.destinationOrder)
      source.destinationOrder = [
        ...new Set(
          source.destinationOrder.map((id) =>
            id === oldTargetId ? targetId : id,
          ),
        ),
      ];
    return JSON.stringify([sourceId, targetId]);
  };
  const reconnectSource: ModelInternals["reconnectSource"] = (
    s,
    sourceId,
    targetId,
    newSourceId,
    adoptTarget = true,
  ) => {
    const source = api().realTrial(s, sourceId),
      parent = api().realTrial(s, newSourceId);
    if (!source || !parent || !api().realTrial(s, targetId))
      throw Error("Los extremos deben ser trials reales");
    if (
      !api()
        .connections(s)
        .some((e) => e.source === sourceId && e.target === targetId)
    )
      throw Error("Conexión no encontrada");
    if (sourceId === newSourceId) return JSON.stringify([sourceId, targetId]);
    const rules = source.thenGoTo.filter((r) => r.targetId === targetId);
    api().removeConnection(s, sourceId, targetId);
    if (source.destinationOrder)
      source.destinationOrder = source.destinationOrder.filter(
        (id) => id !== targetId,
      );
    if (adoptTarget) api().adopt(s, newSourceId, targetId);
    // Decisions belong to the parent. Move all rules represented by the edge;
    // keep the new parent's Default and let reconciliation restore either fallback.
    const ids = new Set(parent.thenGoTo.map((r) => r.id));
    for (const rule of rules) {
      let id = rule.id;
      while (ids.has(id)) id = api().uniqueId(s, "condition");
      ids.add(id);
      parent.thenGoTo.push({ ...rule, id });
    }
    if (!rules.length) api().addDestination(s, parent, targetId);
    return JSON.stringify([newSourceId, targetId]);
  };
  const insertStructure: ModelInternals["insertStructure"] = (
    s,
    itemId,
    { sourceId, targetId, mode = "sequential", side = "right" },
  ) => {
    const ends = services.insertionEndpoints(s, itemId);
    if (!ends)
      throw Error("Solo se puede insertar una estructura movible con trials");
    if (ends.ids.includes(sourceId) || ends.ids.includes(targetId))
      throw Error("No se puede insertar sobre la misma estructura");
    if (
      !api()
        .connections(s)
        .some((e) => e.source === sourceId && e.target === targetId)
    )
      throw Error("Conexión de destino no encontrada");
    if (!["sequential", "parallel"].includes(mode))
      throw Error("Modo de inserción no válido");
    if (mode === "sequential") {
      api().reconnectTarget(s, sourceId, targetId, ends.entryId);
      // The existing destination stays in its scope when the moved structure rejoins it.
      api().addDestination(
        s,
        required(api().realTrial(s, ends.exitId)),
        targetId,
      );
    } else {
      const source = required(api().realTrial(s, sourceId)),
        outgoing = api()
          .connections(s)
          .filter((e) => e.source === sourceId)
          .map((e) => e.target);
      const order = [
        ...new Set([
          ...(source.destinationOrder ?? []).filter((id) =>
            outgoing.includes(id),
          ),
          ...outgoing,
        ]),
      ];
      order.splice(
        order.indexOf(targetId) + (side === "left" ? 0 : 1),
        0,
        ends.entryId,
      );
      api().connect(s, sourceId, ends.entryId);
      source.destinationOrder = order;
    }
    return {
      ...ends,
      sourceId,
      targetId,
      mode,
      side,
      siblingIds:
        mode === "parallel"
          ? [...(required(api().realTrial(s, sourceId)).destinationOrder ?? [])]
          : null,
    };
  };
  return {
    setDefault,
    adopt,
    addDestination,
    connect,
    setThen,
    removeThen,
    removeConnection,
    reconnectTarget,
    reconnectSource,
    insertStructure,
  };
}
