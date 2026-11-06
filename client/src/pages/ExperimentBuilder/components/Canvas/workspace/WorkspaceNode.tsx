import type { NodeProps } from "@xyflow/react";
import type { WorkspaceNode as Node } from "./types";
import TrialNode from "../TrialNode";
import LoopNode from "../LoopNode";
export default function WorkspaceNode({ data }: NodeProps<Node>) {
  const Component = data.loop ? LoopNode : TrialNode;
  return (
    <div
      data-testid={(data.ghost ? "ghost-" : "item-") + data.itemId}
      style={{
        width: data.width,
        height: data.height,
        cursor: data.free ? "grab" : "pointer",
      }}
    >
      <Component
        data={{
          ...data,
          selected: !!data.selected,
          onClick: () => {},
          onAddBranch:
            data.selected && !data.loop && !data.multiple
              ? () => data.onAdd?.(String(data.itemId))
              : undefined,
          onOpenLoop:
            data.loop && !data.ghost
              ? () => data.onToggle?.(String(data.itemId))
              : undefined,
        }}
      >
        {data.multiple && (
          <label
            className="node-selection-control nodrag nopan"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              aria-label={"Select " + data.name}
              checked={data.selected}
              onChange={(e) =>
                data.onCheck?.(String(data.itemId), e.target.checked)
              }
            />
          </label>
        )}
      </Component>
      {data.isEntry ? (
        <span className="node-status-badge node-status-badge--start">
          ▶ INICIO DEL EXPERIMENTO
        </span>
      ) : data.pendingRoot ? (
        <span className="node-status-badge node-status-badge--partial">
          CONEXIÓN PARCIAL · MOVIBLE
        </span>
      ) : null}
    </div>
  );
}
