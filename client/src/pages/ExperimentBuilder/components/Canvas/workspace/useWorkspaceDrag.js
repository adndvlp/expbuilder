import { useState, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  findInsertion,
  previewInsertion,
  insertionEndpoints,
} from "./insertion.js";
import { getModel } from "./model.js";
export function useWorkspaceDrag(state, layout, execute) {
  const M = getModel(),
    flow = useReactFlow(),
    frame = useRef(null),
    [offset, setOffset] = useState(null),
    [proposal, setProposal] = useState(null);
  const cancel = () => {
    if (frame.current) frame.current.cancelled = true;
    setOffset(null);
    setProposal(null);
  };
  return {
    frame,
    offset,
    proposal,
    cancel,
    events: {
      onNodeDragStart: (_, node) => {
        frame.current = {
          id: node.id,
          start: { ...node.position },
          state,
          layout,
          key: null,
          preview: null,
        };
      },
      onNodeDrag: (_, node) => {
        const f = frame.current;
        if (!f || f.cancelled) return;
        const c = M.componentFor(f.state, node.id);
        if (!c || c.locked) return;
        setOffset({
          ids: c.ids,
          dx: node.position.x - f.start.x,
          dy: node.position.y - f.start.y,
        });
        const candidate = findInsertion(
          f.state,
          f.layout,
          node.id,
          {
            x: node.position.x + node.measured.width / 2,
            y: node.position.y + node.measured.height / 2,
          },
          flow.getZoom(),
        );
        const key =
          candidate &&
          JSON.stringify([
            candidate.sourceId,
            candidate.targetId,
            candidate.mode,
            candidate.side,
          ]);
        if (f.key === key) return;
        f.key = key;
        try {
          f.preview = candidate
            ? { ...previewInsertion(f.state, node.id, candidate), candidate }
            : null;
        } catch {
          f.preview = null;
        }
        setProposal(f.preview);
      },
      onNodeDragStop: (_, node) => {
        const f = frame.current;
        frame.current = null;
        setOffset(null);
        setProposal(null);
        if (!f || f.cancelled) return;
        if (f.preview) {
          void execute("insertStructure", {
            itemId: node.id,
            ...f.preview.candidate,
            endpoints: insertionEndpoints(f.state, node.id),
          });
          return;
        }
        const c = M.componentFor(f.state, node.id);
        if (!c || c.locked) return;
        const dx = node.position.x - f.start.x,
          dy = node.position.y - f.start.y;
        if (!dx && !dy) return;
        void execute("moveGroup", {
          itemId: node.id,
          anchors: Object.fromEntries(
            [...c.ids]
              .filter((id) => f.layout.positions[id])
              .map((id) => [
                id,
                {
                  x: f.layout.positions[id].x + dx,
                  y: f.layout.positions[id].y + dy,
                },
              ]),
          ),
        });
      },
    },
  };
}
