import { ParamsOverrideCondition, Parameter, LoadedTrial } from "./types";
import { useComponentMetadata } from "../hooks/useComponentMetadata";
import ParameterTargetSelector from "./ParameterOverrideRow/ParameterTargetSelector";
import OverrideValueCell from "./ParameterOverrideRow/OverrideValueCell";

type Props = {
  paramKey: string;
  condition: ParamsOverrideCondition;
  conditionId: number;
  currentTrialParameters: Parameter[];
  getCurrentTrialCsvColumns: () => string[];
  setConditionsWrapper: (
    newConditions: ParamsOverrideCondition[],
    shouldSave?: boolean,
  ) => void;
  conditions: ParamsOverrideCondition[];
  hasDynamicTrial: boolean;
  currentTrial: LoadedTrial | null;
  hasSurveyJsonParam?: boolean;
};

export function ParameterOverrideRow({
  paramKey,
  condition,
  conditionId,
  currentTrialParameters,
  getCurrentTrialCsvColumns,
  setConditionsWrapper,
  conditions,
  hasDynamicTrial,
  currentTrial,
  hasSurveyJsonParam = false,
}: Props) {
  const paramValue = condition.paramsToOverride![paramKey];
  const csvColumns = getCurrentTrialCsvColumns();

  // Helper to get prop value
  const getPropValue = (prop: unknown): unknown => {
    if (
      prop &&
      typeof prop === "object" &&
      "source" in prop &&
      "value" in prop
    ) {
      return (prop as { value: unknown }).value;
    }
    return prop;
  };

  // Para dynamic plugins, parseamos el paramKey: fieldType::componentIdx::paramKey or ::questionName
  const isDynamic = paramKey.includes("::");
  let fieldType = "";
  let componentIdx = "";
  let actualParamKey = paramKey;
  let questionName = "";

  if (isDynamic) {
    const parts = paramKey.split("::");
    if (parts.length === 3) {
      [fieldType, componentIdx, actualParamKey] = parts;
    } else if (parts.length === 4) {
      [fieldType, componentIdx, actualParamKey, questionName] = parts;
    }
  }

  // Get component array for dynamic plugins
  const compArr =
    hasDynamicTrial && fieldType && currentTrial
      ? (
          currentTrial.columnMapping?.[fieldType] as
            | { value?: unknown[] }
            | undefined
        )?.value || []
      : [];

  const comp =
    componentIdx !== "" && compArr.length > 0
      ? (
          compArr as Array<{
            name?: unknown;
            type?: string;
            survey_json?: unknown;
            [key: string]: unknown;
          }>
        ).find((c) => {
          const name = getPropValue(c.name);
          return name === componentIdx;
        })
      : null;

  // Load component metadata
  const { metadata: componentMetadata } = useComponentMetadata(
    (comp as { type?: string } | null)?.type || null,
  );

  // Get available parameters for the selected component
  const availableParams = componentMetadata?.parameters
    ? Object.entries(componentMetadata.parameters).map(([key, param]) => ({
        key,
        label: param.pretty_name || key,
        type: param.type,
        default: param.default,
      }))
    : [];

  // Find parameter definition
  const param = isDynamic
    ? availableParams.find((p) => p.key === actualParamKey)
    : currentTrialParameters.find((p) => p.key === paramKey);

  const updateParameterOverride = (
    source: "csv" | "typed" | "none",
    value: unknown,
  ) => {
    setConditionsWrapper(
      conditions.map((c) => {
        if (c.id === conditionId) {
          return {
            ...c,
            paramsToOverride: {
              ...(c.paramsToOverride || {}),
              [paramKey]: {
                source: source as "csv" | "typed" | "none",
                value: value as string | number | boolean | unknown[] | null,
              },
            },
          };
        }
        return c;
      }),
      true, // trigger autosave
    );
  };

  const removeParameter = () => {
    setConditionsWrapper(
      conditions.map((c) => {
        if (c.id === conditionId && c.paramsToOverride) {
          const newParams = { ...c.paramsToOverride };
          delete newParams[paramKey];
          return { ...c, paramsToOverride: newParams };
        }
        return c;
      }),
      true,
    );
  };

  const changeParameterKey = (newKey: string) => {
    if (newKey === "") {
      removeParameter();
    } else if (newKey !== paramKey) {
      setConditionsWrapper(
        conditions.map((c) => {
          if (c.id === conditionId) {
            const newParams = { ...c.paramsToOverride };
            delete newParams[paramKey];
            newParams[newKey] = paramValue;
            return { ...c, paramsToOverride: newParams };
          }
          return c;
        }),
        true,
      );
    }
  };

  return (
    <>
      <ParameterTargetSelector
        actualParamKey={actualParamKey}
        availableParams={availableParams}
        changeParameterKey={changeParameterKey}
        comp={comp}
        compArr={compArr}
        componentIdx={componentIdx}
        currentTrialParameters={currentTrialParameters}
        fieldType={fieldType}
        getPropValue={getPropValue}
        hasDynamicTrial={hasDynamicTrial}
        hasSurveyJsonParam={hasSurveyJsonParam}
        questionName={questionName}
        removeParameter={removeParameter}
      />
      <OverrideValueCell
        actualParamKey={actualParamKey}
        comp={comp}
        componentIdx={componentIdx}
        csvColumns={csvColumns}
        fieldType={fieldType}
        hasDynamicTrial={hasDynamicTrial}
        param={param}
        paramKey={paramKey}
        paramValue={paramValue}
        questionName={questionName}
        updateParameterOverride={updateParameterOverride}
      />
    </>
  );
}
