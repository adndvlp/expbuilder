import { useState } from "react";
import type { Trial } from "../../../types";
import type { Condition } from "../types";
import useTrials from "../../../../../hooks/useTrials";
import { saveBranchingIntent } from "../../../../../modules/experiment-authoring/intents/branching";

type Props = {
  trial: Trial;
  candidates: { id: string | number; name: string }[];
  conditions: Condition[];
};
export default function DefaultDestination({
  trial,
  candidates,
  conditions,
}: Props) {
  const { getTrial, updateTrial, updateLoop } = useTrials();
  const [error, setError] = useState<string | null>(null);
  const isInLoop = trial.parentLoopId != null;
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        marginBottom: "24px",
        padding: "20px",
        border: "1px solid var(--neutral-mid)",
        borderRadius: "12px",
        backgroundColor: "var(--neutral-light)",
        color: "var(--text-dark)",
        fontSize: "14px",
        fontWeight: 600,
      }}
    >
      Default destination
      <select
        aria-label="Default destination"
        style={{ width: "100%", maxWidth: "480px", minHeight: "40px" }}
        value={
          trial.defaultNextTrialId ?? (isInLoop ? "" : "FINISH_EXPERIMENT")
        }
        onChange={async (event) => {
          const target = event.target.value || null;
          try {
            const current = await getTrial(trial.id);
            if (!current) throw new Error("Trial not found");
            await saveBranchingIntent({
              item: current,
              conditions,
              defaultNextTrialId: target,
              isBranchTarget: (id) =>
                id === "FINISH_EXPERIMENT" ||
                candidates.some((item) => String(item.id) === String(id)),
              dependencies: { updateTrial, updateLoop },
            });
            setError(null);
          } catch (cause) {
            setError(String(cause));
          }
        }}
      >
        {isInLoop && <option value="">End this route</option>}
        {candidates.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        <option value="FINISH_EXPERIMENT">Finish experiment</option>
      </select>
      {error && <span role="alert">{error}</span>}
    </label>
  );
}
