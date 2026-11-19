import type {
  ModelState,
  Placement,
} from "../../../../../../../shared/experiment-workspace/dist/types.js";
import type { Connection } from "@xyflow/react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Execute,
  WorkspaceEdge,
  ConnectionRequest,
  BranchRequest,
  ConnectionModal,
} from "./types";
import { insertionEndpoints } from "./insertion.js";
import { getModel } from "./model.js";
export function useWorkspaceConnections(
  state: ModelState,
  execute: Execute,
  select: (id: string) => void,
  revision: string | undefined,
  modal: ConnectionModal | null,
  setModal: Dispatch<SetStateAction<ConnectionModal | null>>,
) {
  const M = getModel();
  const submit = async (
    request: BranchRequest,
    scopeId: string | null | undefined,
    mode: Placement,
  ) => {
    const base = {
      sourceId: request.parentId,
      mode,
      ...(scopeId !== undefined ? { scopeId } : {}),
    };
    const result = request.connection
      ? await execute(
          "connect",
          {
            ...base,
            targetId: request.connection.target,
            previous: request.connection.previous,
            edgeRefs: request.connection.edgeRefs,
            endpoints: request.connection.endpoints ?? undefined,
          },
          request.revision,
        )
      : await execute("addChild", base, request.revision);
    if (result) {
      setModal(null);
      select(String(request.connection ? request.parentId : result.result));
    }
  };
  const add = (parentId: string) => {
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
  const request = (connection: ConnectionRequest) => {
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
      if (connection.source !== p.source)
        void execute("reconnectSource", {
          edgeRefs: connection.edgeRefs,
          sourceId: p.source,
          targetId: p.target,
          newSourceId: connection.source,
        });
      else
        void execute("reconnectTarget", {
          edgeRefs: connection.edgeRefs,
          sourceId: p.source,
          oldTargetId: p.target,
          targetId: connection.target,
        });
    } else
      void execute("connect", {
        sourceId: connection.source,
        targetId: connection.target,
      });
  };
  const normalize = (c: Connection | WorkspaceEdge) =>
    c.sourceHandle != null &&
    c.targetHandle != null &&
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
    chooseLevel: (scopeId: string | null) => {
      if (!modal) return;
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
    connect: (c: Connection) => {
      const normalized = normalize(c);
      if (normalized) request(normalized);
    },
    valid: (c: Connection | WorkspaceEdge) => !!normalize(c),
    reconnect: (edge: WorkspaceEdge, c: Connection) => {
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
