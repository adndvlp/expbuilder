export function assertEdgePermission(model, state, kind, args) {
  const previous =
    kind === "reconnectTarget"
      ? { source: args.sourceId, target: args.oldTargetId }
      : (args.previous ?? { source: args.sourceId, target: args.targetId });
  if (
    !["removeConnection", "reconnectSource", "reconnectTarget"].includes(
      kind,
    ) &&
    !args.previous
  )
    return;
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
