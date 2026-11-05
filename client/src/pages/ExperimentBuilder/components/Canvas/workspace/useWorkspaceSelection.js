import useTrials from "../../../hooks/useTrials";
import { useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";

export function useWorkspaceSelection(document) {
  const { workspaceSelection: raw, setWorkspaceSelection: setSelection } =
    useTrials();
  const valid = new Set(
    [...document.trials, ...document.loops].map((i) => String(i.id)),
  );
  const selection =
    raw?.type === "items"
      ? { ...raw, ids: raw.ids.filter((id) => valid.has(id)) }
      : raw?.type === "item" && !valid.has(raw.id)
        ? null
        : raw;
  const rectangle = useRef(null),
    flow = useReactFlow();
  const selectedIds = new Set(
    selection?.type === "items"
      ? selection.ids
      : selection?.type === "item"
        ? [selection.id]
        : [],
  );
  const clear = useCallback(() => setSelection(null), [setSelection]);
  const select = useCallback(
    (id) => setSelection({ type: "item", id }),
    [setSelection],
  );
  const check = useCallback(
    (id, checked) =>
      setSelection((old) => {
        if (old?.type !== "items") return old;
        const mark = checked ?? !old.ids.includes(id);
        return {
          ...old,
          ids: mark
            ? [...new Set([...old.ids, id])]
            : old.ids.filter((i) => i !== id),
        };
      }),
    [setSelection],
  );
  const prepareRectangle = (event) => {
    if (
      event.button === 0 &&
      event.isPrimary &&
      event.target.classList.contains("react-flow__pane")
    )
      rectangle.current = {
        start: { x: event.clientX, y: event.clientY },
        active: false,
      };
  };
  const updateRectangle = (event) => {
    const frame = rectangle.current;
    if (!frame?.active) return;
    const a = flow.screenToFlowPosition(frame.start),
      b = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const bounds = {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
    const ids =
      bounds.width > 0 && bounds.height > 0
        ? flow
            .getIntersectingNodes(bounds, true)
            .filter((n) => !n.data.ghost && n.selectable !== false)
            .map((n) => n.id)
        : [];
    setSelection({ type: "items", ids });
  };
  const ignore = (event) =>
    event.target.closest("input,button,.react-flow__handle");
  return {
    selection,
    setSelection,
    selectedIds,
    select,
    clear,
    check,
    rectangle,
    events: {
      onPointerDownCapture: prepareRectangle,
      onPointerMove: updateRectangle,
      onSelectionStart: () => {
        if (rectangle.current) rectangle.current.active = true;
      },
      onSelectionEnd: (event) => {
        updateRectangle(event);
        rectangle.current = null;
      },
      onNodeClick: (event, node) => {
        if (node.data.ghost || ignore(event)) return;
        selection?.type === "items" ? check(node.id) : select(node.id);
      },
      onNodeDoubleClick: (event, node) => {
        if (!ignore(event))
          setSelection((old) => ({
            type: "items",
            ids: [
              ...new Set([...(old?.type === "items" ? old.ids : []), node.id]),
            ],
          }));
      },
      onEdgeClick: (_, edge) => {
        if (!edge.data.control)
          setSelection({ type: "edge", id: edge.data.selectionId });
      },
    },
  };
}
