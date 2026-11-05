import "@xyflow/react/dist/style.css";
import { ReactFlowProvider } from "@xyflow/react";
import useTrials from "../../hooks/useTrials";
import LegacyCanvas from "./LegacyCanvas";
import WorkspaceCanvas from "./workspace/WorkspaceCanvas";
export default function Canvas() {
  const { graph, isLoading } = useTrials();
  if (!graph)
    return (
      <div role="status">
        {isLoading ? "Loading experiment…" : "Unable to load experiment."}
      </div>
    );
  return graph?.workspace ? (
    <ReactFlowProvider>
      <WorkspaceCanvas document={graph.workspace} />
    </ReactFlowProvider>
  ) : (
    <LegacyCanvas />
  );
}
