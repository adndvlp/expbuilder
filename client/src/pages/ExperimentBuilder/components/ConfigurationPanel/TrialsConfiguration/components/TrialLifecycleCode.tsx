import type { Trial } from "../../types";
import TrialCodeInjection from "../TrialCodeInjection";
import {
  generateInitializeCode,
  generateOnFinishCode,
  generateOnLoadCode,
  generateOnStartCode,
} from "../TrialCode/TrialCodeGenerators";

interface Props {
  onSave: (field: string, value: string) => unknown;
  trial: Trial | null;
}

export default function TrialLifecycleCode({ onSave, trial }: Props) {
  const isTrialInLoop = !!trial?.parentLoopId;
  const getVarNameForTrial = (baseName: string): string => {
    if (!trial?.parentLoopId) return baseName;
    const sanitized = String(trial.parentLoopId).replace(/[^a-zA-Z0-9_]/g, "_");
    return `loop_${sanitized}_${baseName}`;
  };

  return (
    <TrialCodeInjection
      tabs={[
        {
          key: "initialize",
          label: "initialize",
          hint: "async setup before trial starts — can return a Promise to delay until ready",
          fieldKey: "customInitialize",
          customValue: trial?.customInitialize ?? "",
          computePreview: (userCode) =>
            generateInitializeCode(userCode) ||
            `initialize: async function() {\n  // Your code runs here\n},`,
        },
        {
          key: "onStart",
          label: "on_start",
          hint: "runs before trial starts, has access to trial params",
          fieldKey: "customOnStart",
          customValue: trial?.customOnStart ?? "",
          computePreview: (userCode) =>
            generateOnStartCode({
              paramsOverride: trial?.paramsOverride,
              isInLoop: isTrialInLoop,
              getVarName: getVarNameForTrial,
              customOnStart: userCode,
            }) || `on_start: function(trial) {\n  // Your code runs here\n},`,
          isBuilderManaged: true,
        },
        {
          key: "onLoad",
          label: "on_load",
          hint: "runs once stimulus is displayed and ready",
          fieldKey: "customOnLoad",
          customValue: trial?.customOnLoad ?? "",
          computePreview: (userCode) =>
            generateOnLoadCode(userCode) ||
            `on_load: function() {\n  // Your code runs here\n},`,
        },
        {
          key: "onFinish",
          label: "on_finish",
          hint: "runs after trial ends, has access to data",
          fieldKey: "customOnFinish",
          customValue: trial?.customOnFinish ?? "",
          computePreview: (userCode) =>
            generateOnFinishCode({
              branches: trial?.branches,
              branchConditions: trial?.branchConditions,
              repeatConditions: trial?.repeatConditions,
              isInLoop: isTrialInLoop,
              getVarName: getVarNameForTrial,
              customOnFinish: userCode,
            }) || `on_finish: function(data) {\n  // Your code runs here\n},`,
          isBuilderManaged: true,
        },
      ]}
      onSave={onSave}
    />
  );
}
