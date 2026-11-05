import { routeBoundaryEdges } from "./boundaryRouting.js";
export function project(
  state,
  layout,
  selection,
  { onAdd, onToggle, onCheck },
  model,
) {
  const ids = new Set(
      selection?.type === "items"
        ? selection.ids
        : selection?.type === "item"
          ? [selection.id]
          : [],
    ),
    multiple = selection?.type === "items";
  const entry = model.realTrial(state, model.resolve(state, state.entryId));
  const visible =
    entry &&
    [entry.id, ...model.ancestors(state, entry).map((l) => l.id)].find(
      (id) => layout.positions[id],
    );
  return {
    nodes: layout.flowNodes.map((n) => ({
      ...n,
      connectable: n.type !== "loop",
      selected: ids.has(n.id),
      data: {
        ...n.data,
        itemId: n.id,
        loop: n.type === "loop",
        name: model.item(state, n.id).name,
        selected: ids.has(n.id),
        multiple,
        onCheck,
        isEntry: n.id === visible,
        width: n.measured.width,
        height: n.measured.height,
        onAdd,
        onToggle,
      },
    })),
    edges: layout.flowEdges.map((e) => {
      const selected =
        !e.data.control &&
        selection?.type === "edge" &&
        e.data.selectionId === selection.id;
      const canReconnect = !!(
          selected &&
          e.data.editable &&
          model.realTrial(state, e.source) &&
          model.realTrial(state, e.target)
        ),
        stroke = "#f1c40f";
      return {
        ...e,
        data: { ...e.data, canReconnect },
        selectable: !e.data.control,
        selected,
        reconnectable: canReconnect,
        zIndex: selected ? 10 : e.zIndex,
        style: selected
          ? {
              ...e.style,
              stroke,
              strokeWidth: 3,
              filter: "drop-shadow(0 0 4px #f1c40fcc)",
            }
          : e.style,
        markerEnd:
          selected && e.markerEnd && typeof e.markerEnd === "object"
            ? { ...e.markerEnd, color: stroke }
            : e.markerEnd,
      };
    }),
  };
}
export function ghostProjection(state, proposal, projection, nodes, model) {
  if (!proposal) return null;
  const ids = new Set(proposal.ids),
    byId = new Map(projection.nodes.map((n) => [n.id, n])),
    existing = new Set(
      projection.edges.map((e) => e.data.semantic).filter(Boolean),
    );
  const proposed = proposal.layout.flowNodes.map((n) => {
    const ghost = ids.has(n.id),
      original = byId.get(n.id);
    return {
      ...n,
      id: ghost ? "ghost:" + n.id : n.id,
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
      selected: false,
      className: ghost ? "workspace-ghost" : n.className,
      style: ghost ? { opacity: 0.65, pointerEvents: "none" } : n.style,
      data: {
        ...n.data,
        ...original?.data,
        itemId: n.id,
        name: model.item(state, n.id).name,
        loop: n.type === "loop",
        ghost,
        selected: false,
        multiple: false,
        pendingRoot: false,
        width: n.measured.width,
        height: n.measured.height,
      },
    };
  });
  const edges = proposal.layout.flowEdges.map((e) => {
    const added = !e.data.control && !existing.has(e.data.semantic),
      stroke = added ? "#f1c40f" : e.style?.stroke;
    return {
      ...e,
      id: "proposal:" + e.id,
      source: ids.has(e.source) ? "ghost:" + e.source : e.source,
      target: ids.has(e.target) ? "ghost:" + e.target : e.target,
      selected: false,
      selectable: false,
      reconnectable: false,
      focusable: false,
      style: {
        ...e.style,
        ...(added ? { stroke, strokeWidth: 2.5, strokeDasharray: "6 4" } : {}),
      },
      markerEnd:
        added && typeof e.markerEnd === "object"
          ? { ...e.markerEnd, color: stroke }
          : e.markerEnd,
      data: { ...e.data, canReconnect: false },
    };
  });
  return {
    nodes: [
      ...proposed,
      ...nodes
        .filter((n) => ids.has(n.id))
        .map((n) => ({
          ...n,
          style: { ...n.style, opacity: 0 },
          data: { ...n.data, multiple: false },
        })),
    ],
    edges,
  };
}
export function translatedProjection(projection, offset) {
  if (!offset) return projection;
  const { ids, dx, dy } = offset;
  const translated = {
    nodes: projection.nodes.map((n) =>
      ids.has(n.id)
        ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
        : n,
    ),
    edges: projection.edges.map((e) => {
      if (!ids.has(e.source) || !ids.has(e.target)) return e;
      const data = { ...e.data };
      if (data.curve)
        data.curve = data.curve.map((c) =>
          Object.fromEntries(
            Object.entries(c).map(([k, p]) => [
              k,
              { x: p.x + dx, y: p.y + dy },
            ]),
          ),
        );
      if (data.routeX !== undefined) data.routeX += dx;
      if (data.routeTopY !== undefined) data.routeTopY += dy;
      if (data.routeBottomY !== undefined) data.routeBottomY += dy;
      return { ...e, data };
    }),
  };
  const boundary = translated.edges
    .filter((e) => e.data.boundary && (ids.has(e.source) || ids.has(e.target)))
    .map((e) => ({ ...e, data: { ...e.data } }));
  routeBoundaryEdges(translated.nodes, boundary);
  const rerouted = new Map(boundary.map((e) => [e.id, e]));
  translated.edges = translated.edges.map((e) => rerouted.get(e.id) ?? e);
  return translated;
}
