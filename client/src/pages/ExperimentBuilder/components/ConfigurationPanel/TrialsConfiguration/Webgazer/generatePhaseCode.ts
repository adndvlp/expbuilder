import { useEffect, useState } from "react";
import { usePluginParameters } from "../../hooks/usePluginParameters"; // Make sure path is correct
import { useCsvMapper } from "../Csv/useCsvMapper";
import { ColumnMapping, Trial } from "../../types";
import { renderPhaseCode } from "./services/renderPhaseCode";
import { toCodeIdentifier } from "../../../../utils/codegen/codeIdentifier";

type PhaseProps = {
  pluginName: string;
  instructions: any[];
  csvJson: any[];
  setCsvJson: React.Dispatch<React.SetStateAction<any[]>>;
  selectedTrial: Trial | null;
  setTrialName: React.Dispatch<React.SetStateAction<string>>;
  setCsvColumns: React.Dispatch<React.SetStateAction<string[]>>;
  columnMapping: ColumnMapping;
  setColumnMapping: React.Dispatch<React.SetStateAction<ColumnMapping>>;
  setIsLoadingTrial: React.Dispatch<React.SetStateAction<boolean>>;
};

export const generatePhaseCode = ({
  pluginName,
  instructions,
  csvJson,
  setCsvJson,
  selectedTrial,
  setTrialName,
  setCsvColumns,
  columnMapping,
  setColumnMapping,
  setIsLoadingTrial,
}: PhaseProps) => {
  // Extract trial logic properties from selectedTrial
  const paramsOverride = selectedTrial?.paramsOverride;
  const parentLoopId = (selectedTrial as any)?.parentLoopId;
  const isInLoop = Boolean(parentLoopId || (selectedTrial as any)?.isInLoop);

  // Helper for dynamic variable names
  const getVarName = (baseName: string): string => {
    if (!isInLoop || !parentLoopId) {
      return baseName;
    }
    const sanitizedParentId = toCodeIdentifier(parentLoopId);
    return `loop_${sanitizedParentId}_${baseName}`;
  };

  useEffect(() => {
    if (selectedTrial) {
      setIsLoadingTrial(true);
      setTrialName(selectedTrial.name || "");
      const include = selectedTrial.parameters?.include_instructions ?? false;
      setIncludeInstructions(!!include[pluginName]);
      setMinimumPercentAcceptable(
        selectedTrial.parameters.minimum_percent ?? 50,
      );
      // Restaura CSV y columnas si existen
      setColumnMapping(selectedTrial.columnMapping || {});
      setCsvJson(selectedTrial.csvJson || []);
      setCsvColumns(selectedTrial.csvColumns || []);

      setTimeout(() => {
        setIsLoadingTrial(false);
      }, 100); // 500 en producción
    }
    // eslint-disable-next-line
  }, [selectedTrial]);

  const [minimumPercentAcceptable, setMinimumPercentAcceptable] =
    useState<number>(50);
  // All the logic that you were repeating is now inside this single hook
  const { parameters, data } = usePluginParameters(pluginName);
  const [includeInstructions, setIncludeInstructions] = useState(false);

  const fieldGroups = { parameters, instructions };

  const { getColumnValue } = useCsvMapper({ fieldGroups });

  // const activeParameters = fieldGroups.parameters.filter(
  //   (p) => columnMapping[p.key]?.source !== "none"
  // );

  const mappedJson = (() => {
    const mapRow = (row?: Record<string, any>) => {
      const result: Record<string, any> = {};

      // obtener solo los parámetros activos(mapeados), ignora los defaults (activeParameters)
      // al momento de llevarlo al código generado
      if (pluginName !== "plugin-webgazer-recalibrate") {
        fieldGroups.parameters.forEach((param) => {
          const { key } = param;
          result[key] = getColumnValue(columnMapping[key], row, undefined, key);
        });
      }

      if (includeInstructions) {
        fieldGroups.instructions.forEach((fixParam) => {
          result[fixParam.key] = getColumnValue(
            columnMapping[fixParam.key],
            row,
            fixParam.default,
            fixParam.key,
          );
        });
      }

      return result;
    };

    if (csvJson.length > 0) {
      return csvJson.map((row) => mapRow(row));
    } else {
      return [mapRow()];
    }
  })();

  const trialCode = renderPhaseCode({
    pluginName,
    parameters,
    data,
    mappedJson,
    includeInstructions,
    minimumPercentAcceptable,
    paramsOverride,
    isInLoop,
    getVarName,
  });

  // Return all the state and setters in a single, convenient object
  return {
    minimumPercentAcceptable,
    setMinimumPercentAcceptable,
    data,
    columnMapping,
    setColumnMapping,
    includeInstructions,
    setIncludeInstructions,
    fieldGroups,
    mappedJson,
    trialCode,
  };
};
