import { insertionEndpoints } from "./insertion.js";
import { getModel } from "./model.js";
export function useWorkspaceConnections(
  state,
  execute,
  select,
  revision,
  modal,
  setModal,
) {
  const M = getModel();
  const submit = async (request, scopeId, mode) => {
    const args = { sourceId: request.parentId, mode };
    if (scopeId !== undefined) args.scopeId = scopeId;
    if (request.connection) {
      args.targetId = request.connection.target;
      args.previous = request.connection.previous;
      args.edgeRefs = request.connection.edgeRefs;
      args.endpoints = request.connection.endpoints;
    }
    const result = await execute(
      request.connection ? "connect" : "addChild",
      args,
      request.revision,
    );
    if (result) {
      setModal(null);
      select(String(request.connection ? request.parentId : result.result));
    }
  };
  const add = (parentId) => {
    if (M.realTrial(state, parentId)?.parentLoopId) {
      setModal({
        revision,
        type: "level",
        parentId,
        levels: M.loopBranchLevels(state, parentId),
      });
      return;
    }
    if (M.connections(state).some((e) => e.source === parentId)) {
      setModal({ type: "placement", parentId, revision });
      return;
    }
    void submit({ parentId, revision }, undefined, "parallel");
  };
  const request = (connection) => {
    const context = M.loopConnectionContext(
      state,
      connection.source,
      connection.target,
      connection.previous,
    );
    if (context) {
      if (context.canPlaceDestination)
        connection = {
          ...connection,
          endpoints: insertionEndpoints(
            state,
            connection.target,
            connection.target,
          ),
        };
      setModal({
        revision,
        type: "level",
        parentId: connection.source,
        connection,
        levels: context.levels,
      });
      return;
    }
    if (connection.previous) {
      const p = connection.previous;
      void execute(
        connection.source !== p.source ? "reconnectSource" : "reconnectTarget",
        connection.source !== p.source
          ? {
              edgeRefs: connection.edgeRefs,
              sourceId: p.source,
              targetId: p.target,
              newSourceId: connection.source,
            }
          : {
              edgeRefs: connection.edgeRefs,
              sourceId: p.source,
              oldTargetId: p.target,
              targetId: connection.target,
            },
      );
    } else
      void execute("connect", {
        sourceId: connection.source,
        targetId: connection.target,
      });
  };
  const normalize = (c) =>
    ["flow-source", "flow-target"].includes(c.sourceHandle) &&
    ["flow-source", "flow-target"].includes(c.targetHandle) &&
    M.normalizeConnection(
      state,
      c.source,
      c.sourceHandle === "flow-source" ? "bottom" : "top",
      c.target,
      c.targetHandle === "flow-source" ? "bottom" : "top",
    );
  return {
    modal,
    setModal,
    add,
    submit,
    chooseLevel: (scopeId) => {
      const choice = M.loopBranchSelection(
        state,
        {
          sourceId: modal.parentId,
          targetId: modal.connection?.target,
          previous: modal.connection?.previous,
        },
        scopeId,
      );
      if (!choice) return;
      if (choice.requiresPlacement)
        setModal({ ...modal, type: "placement", scopeId });
      else void submit(modal, scopeId, "parallel");
    },
    connect: (c) => {
      const normalized = normalize(c);
      if (normalized) request(normalized);
    },
    valid: (c) => !!normalize(c),
    reconnect: (edge, c) => {
      if (
        !edge.data.editable ||
        c.sourceHandle !== "flow-source" ||
        c.targetHandle !== "flow-target"
      )
        return;
      const previous = M.connections(state).find(
        (e) => e.id === edge.data.semantic,
      );
      if (!previous) return;
      if (!M.realTrial(state, c.source) || !M.realTrial(state, c.target))
        return;
      if ((c.source !== previous.source) === (c.target !== previous.target))
        return;
      request({
        edgeRefs: edge.data.semantics,
        source: c.source,
        target: c.target,
        previous: { source: previous.source, target: previous.target },
      });
    },
  };
}
