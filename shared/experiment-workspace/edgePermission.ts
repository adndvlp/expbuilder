import type { NormalizedCommand } from "./commandTypes.js";
import type { ModelState } from "./types.js";
import type { createWorkspaceModel } from "./model.js";
export function assertEdgePermission(
  model: ReturnType<typeof createWorkspaceModel>,
  state: ModelState,
  command: NormalizedCommand,
) {
  if (
    command.kind !== "removeConnection" &&
    command.kind !== "reconnectSource" &&
    command.kind !== "reconnectTarget" &&
    !(command.kind === "connect" && command.args.previous)
  )
    return;
  const args = command.args;
  const previous =
    command.kind === "reconnectTarget"
      ? { source: command.args.sourceId, target: command.args.oldTargetId }
      : "previous" in args && args.previous
        ? args.previous
        : { source: args.sourceId, target: args.targetId };
  if (args.edgeRefs !== undefined) {
    if (!Array.isArray(args.edgeRefs) || args.edgeRefs.length !== 1)
      throw Object.assign(Error("An aggregated edge cannot be edited"), {
        status: 409,
        code: "EDGE_AGGREGATED",
      });
    if (
      args.edgeRefs[0] !==
      JSON.stringify([String(previous.source), String(previous.target)])
    )
      throw Error("The selected edge does not represent this connection");
  }
  if (
    !model
      .connections(state)
      .some((e) => e.source === previous.source && e.target === previous.target)
  )
    throw Error("Connection not found");
}
