import { Condition, Parameter } from "../../../types";
import { useComponentMetadata } from "../../../../hooks/useComponentMetadata";
import ColumnValue from "./ColumnValue";
import ColumnParams from "./ColumnParams";

type Props = {
  condition: Condition;
  paramKey: string;
  targetTrialParameters: Record<string, Parameter[]>;
  findTrialById: (trialId: string | number) => any;
  isJumpCondition: boolean;
  setConditions: (conditions: Condition[], shouldSave?: boolean) => void;
  conditions: Condition[];
  targetTrialCsvColumns: Record<string, string[]>;
  triggerSave?: () => void;
  isTargetDynamic: boolean;
  hasSurveyJsonParam?: boolean;
};

export function ParameterOverride({
  condition,
  paramKey,
  targetTrialParameters,
  findTrialById,
  setConditions,
  conditions,
  targetTrialCsvColumns,
  triggerSave,
  isTargetDynamic,
  hasSurveyJsonParam = false,
}: Props) {
  // Helper para extraer valor de propiedades en formato {source, value}
  const getPropValue = (prop: any): any => {
    if (
      prop &&
      typeof prop === "object" &&
      "source" in prop &&
      "value" in prop
    ) {
      return prop.value;
    }
    return prop;
  };

  const targetTrial = findTrialById(condition.nextTrialId);

  // For dynamic plugins, parse the paramKey to get field structure
  let fieldType = "";
  let componentIdx = "";
  let propName = "";
  let questionName = "";
  if (isTargetDynamic && paramKey.includes("::")) {
    const parts = paramKey.split("::");
    if (parts.length === 3) {
      [fieldType, componentIdx, propName] = parts;
    } else if (parts.length === 4) {
      [fieldType, componentIdx, propName, questionName] = parts;
    }
  }

  // Get component array and specific component for dynamic plugins
  const compArr =
    isTargetDynamic && fieldType
      ? targetTrial?.columnMapping?.[fieldType]?.value || []
      : [];
  const comp =
    isTargetDynamic && componentIdx !== "" && compArr.length > 0
      ? compArr.find((c: any) => getPropValue(c.name) === componentIdx)
      : null;

  // Load component metadata to get available parameters
  const { metadata: componentMetadata, loading: metadataLoading } =
    useComponentMetadata(comp?.type || null);

  // Helper para convertir array a comma separated string
  const arrayToCommaSeparated = (arr: any): string => {
    if (Array.isArray(arr)) {
      return arr.join(", ");
    }
    return "";
  };

  // Helper para convertir comma separated string a array
  const commaSeparatedToArray = (str: string): any[] => {
    if (!str || str.trim() === "") return [];
    return str.split(",").map((item) => item.trim());
  };

  if (!paramKey) {
    // Empty cells
    if (isTargetDynamic) {
      return (
        <>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          {hasSurveyJsonParam && <td className="px-2 py-2"></td>}
          <td className="px-2 py-2"></td>
        </>
      );
    } else {
      return (
        <>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
        </>
      );
    }
  }

  // If paramKey is present, render actual content
  const paramValue = condition.customParameters![paramKey];
  const availableParams = targetTrialParameters[condition.nextTrialId] || [];

  // Convert parameters object to array for easier manipulation
  const parametersArray = componentMetadata?.parameters
    ? Object.entries(componentMetadata.parameters).map(([key, param]) => ({
        key,
        label: param.pretty_name || key,
        type: param.type,
        default: param.default,
        description: param.description,
      }))
    : [];

  return (
    <>
      <ColumnParams
        isTargetDynamic={isTargetDynamic}
        fieldType={fieldType}
        componentIdx={componentIdx}
        propName={propName}
        comp={comp}
        questionName={questionName}
        paramKey={paramKey}
        paramValue={paramValue}
        parametersArray={parametersArray}
        condition={condition}
        conditions={conditions}
        setConditions={setConditions}
        availableParams={availableParams}
        compArr={compArr}
        getPropValue={getPropValue}
        metadataLoading={metadataLoading}
        hasSurveyJsonParam={hasSurveyJsonParam}
      />

      {/* Columna Value */}
      <ColumnValue
        isTargetDynamic={isTargetDynamic}
        fieldType={fieldType}
        componentIdx={componentIdx}
        propName={propName}
        comp={comp}
        questionName={questionName}
        paramValue={paramValue}
        paramKey={paramKey}
        parametersArray={parametersArray}
        condition={condition}
        conditions={conditions}
        setConditions={setConditions}
        availableParams={availableParams}
        targetTrialCsvColumns={targetTrialCsvColumns}
        triggerSave={triggerSave}
      />
    </>
  );
}

// Add Param Button Component
type AddParamProps = {
  condition: Condition;
  addCustomParameter: (conditionId: number, isTargetDynamic: boolean) => void;
  isTargetDynamic: boolean;
  hasSurveyJsonParam?: boolean;
};

export function AddParamButtonCell({
  condition,
  addCustomParameter,
  isTargetDynamic,
  hasSurveyJsonParam = false,
}: AddParamProps) {
  return (
    <>
      <td
        colSpan={isTargetDynamic ? (hasSurveyJsonParam ? 4 : 3) : 1}
        className="px-2 py-2"
        style={{
          backgroundColor: "rgba(255, 209, 102, 0.05)",
          borderLeft: "1px solid var(--neutral-mid)",
        }}
      >
        <button
          onClick={() => addCustomParameter(condition.id, isTargetDynamic)}
          className="px-3 py-1.5 rounded text-sm font-semibold transition w-full flex items-center justify-center gap-1"
          style={{
            backgroundColor: "var(--gold)",
            color: "white",
          }}
        >
          <span className="text-base">+</span> Add param
        </button>
      </td>
      <td
        className="px-2 py-2"
        style={{
          backgroundColor: "rgba(255, 209, 102, 0.05)",
        }}
      ></td>
    </>
  );
}
