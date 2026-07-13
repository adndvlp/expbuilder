import type { LoadedTrial, ParamsOverrideRule } from "../types";

interface Props {
  availableTrials: Array<{ id: string | number; name: string }>;
  onSelect: (trialId: string) => void;
  referencedTrial: LoadedTrial | null;
  rule: ParamsOverrideRule;
}

export default function TrialSelector({
  availableTrials,
  onSelect,
  referencedTrial,
  rule,
}: Props) {
  return (
    <td className="px-2 py-2">
      <select
        value={rule.trialId}
        onChange={(event) => onSelect(event.target.value)}
        className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
        style={{
          color: "var(--text-dark)",
          backgroundColor: "var(--neutral-light)",
          borderColor: "var(--neutral-mid)",
        }}
      >
        <option value="">Select trial...</option>
        {referencedTrial && (
          <option value={referencedTrial.id}>{referencedTrial.name}</option>
        )}
        {availableTrials
          .filter(
            (trial) =>
              trial.id !== rule.trialId &&
              String(trial.id) !== String(rule.trialId),
          )
          .map((trial) => (
            <option key={trial.id} value={trial.id}>
              {trial.name}
            </option>
          ))}
      </select>
    </td>
  );
}
