import { Handle, Position } from "reactflow";
import { CANVAS_HANDLE_IDS } from "../services/canvasHandleIds";

export default function CanvasNodeHandles() {
  return (
    <>
      <Handle
        id={CANVAS_HANDLE_IDS.flowTarget}
        type="target"
        position={Position.Top}
        className="react-flow__handle react-flow__handle-top"
      />
      <Handle
        id={CANVAS_HANDLE_IDS.flowSource}
        type="source"
        position={Position.Bottom}
        className="react-flow__handle react-flow__handle-bottom"
      />
      <Handle
        id={CANVAS_HANDLE_IDS.loopEntrySource}
        type="source"
        position={Position.Left}
        className="canvas-routing-handle canvas-routing-handle--upper"
      />
      <Handle
        id={CANVAS_HANDLE_IDS.loopExitTarget}
        type="target"
        position={Position.Left}
        className="canvas-routing-handle canvas-routing-handle--lower"
      />
      <Handle
        id={CANVAS_HANDLE_IDS.loopReturnTarget}
        type="target"
        position={Position.Right}
        className="canvas-routing-handle canvas-routing-handle--upper"
      />
      <Handle
        id={CANVAS_HANDLE_IDS.loopReturnSource}
        type="source"
        position={Position.Right}
        className="canvas-routing-handle canvas-routing-handle--lower"
      />
    </>
  );
}
