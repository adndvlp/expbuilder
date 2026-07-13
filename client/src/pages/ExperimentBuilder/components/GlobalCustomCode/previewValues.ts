import {
  getLocalOnDataUpdatePreview,
  getLocalOnFinishPreview,
  getPublicOnDataUpdatePreview,
  getPublicOnFinishPreview,
  getPublicOnTrialStartPreview,
} from "../Timeline/ExperimentCode/getInitJsPsychPreview";
import { isBuilderUsed, ParamDef, Variant } from "./config";

function getBuilderPreview(
  param: ParamDef,
  variant: Variant,
  experimentID: string,
  userCode: string,
): string {
  if (variant === "local") {
    const localPreviews: Record<string, () => string> = {
      on_data_update: () => getLocalOnDataUpdatePreview(experimentID, userCode),
      on_finish: () => getLocalOnFinishPreview(experimentID, userCode),
    };
    return localPreviews[param.key]!();
  }
  const publicPreviews: Record<string, () => string> = {
    on_trial_start: () => getPublicOnTrialStartPreview(userCode),
    on_data_update: () => getPublicOnDataUpdatePreview(experimentID, userCode),
    on_finish: () => getPublicOnFinishPreview(experimentID, userCode),
  };
  return publicPreviews[param.key]!();
}

export function resolveRightPreviewValue({
  param,
  previewVariant,
  eid,
  liveValue,
  localParams,
  publicParams,
  activeParam,
  editVariant,
}: {
  param: ParamDef;
  previewVariant: Variant;
  eid: string;
  liveValue: string;
  localParams: Record<string, string | undefined>;
  publicParams: Record<string, string | undefined>;
  activeParam: string;
  editVariant: Variant;
}) {
  if (isBuilderUsed(param, previewVariant)) {
    return getBuilderPreview(param, previewVariant, eid, liveValue);
  }
  const savedParams = previewVariant === "local" ? localParams : publicParams;
  const savedValue = savedParams[activeParam] ?? "";
  const value = previewVariant === editVariant ? liveValue : savedValue;
  return value || `// No user code for this param in ${previewVariant}`;
}
