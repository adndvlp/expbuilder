import type { GraphDiagnostic } from "../../../modules/experiment-graph/types";

type Props = {
  isLoopLoading: boolean;
  loopLoadFailed: boolean;
  diagnostics: readonly GraphDiagnostic[];
};

const describeDiagnostic = (diagnostic: GraphDiagnostic) => {
  const source =
    diagnostic.sourceId === undefined ? null : String(diagnostic.sourceId);
  const target =
    diagnostic.targetId === undefined ? null : String(diagnostic.targetId);
  const item =
    diagnostic.itemId === undefined ? null : String(diagnostic.itemId);
  const context =
    source && target
      ? `${source} → ${target}`
      : source ?? target ?? item;
  return context ? `${diagnostic.code} (${context})` : diagnostic.code;
};

export default function CanvasGraphStatus({
  isLoopLoading,
  loopLoadFailed,
  diagnostics,
}: Props) {
  return (
    <div className="canvas-status" aria-live="polite">
      {isLoopLoading && <span>Loading loop…</span>}
      {loopLoadFailed && <span>Unable to load the selected loop.</span>}
      {diagnostics.length > 0 && (
        <span role="alert" data-testid="experiment-graph-error">
          Experiment graph is invalid:{" "}
          {diagnostics.map(describeDiagnostic).join(", ")}
        </span>
      )}
    </div>
  );
}
