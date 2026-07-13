import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ColumnMapping, Trial } from "../../../types";
import { generatePhaseCode } from "../generatePhaseCode";

interface Args {
  columnMapping: ColumnMapping;
  csvJson: unknown[];
  instructions: [unknown[], unknown[], unknown[], unknown[]];
  plugins: string[];
  selectedTrial: Trial | null;
  setColumnMapping: Dispatch<SetStateAction<ColumnMapping>>;
  setCsvColumns: Dispatch<SetStateAction<string[]>>;
  setCsvJson: Dispatch<SetStateAction<unknown[]>>;
  setIsLoadingTrial: Dispatch<SetStateAction<boolean>>;
  setTrialName: Dispatch<SetStateAction<string>>;
}

export function useWebgazerPhases({
  columnMapping,
  csvJson,
  instructions,
  plugins,
  selectedTrial,
  setColumnMapping,
  setCsvColumns,
  setCsvJson,
  setIsLoadingTrial,
  setTrialName,
}: Args) {
  const [calibratePlugin, initCameraPlugin, recalibratePlugin, validatePlugin] =
    plugins;
  const [
    initInstructions,
    calibrateInstructions,
    validateInstructions,
    recalibrateInstructions,
  ] = instructions;
  const shared = {
    csvJson,
    selectedTrial,
    setTrialName,
    setCsvJson,
    setCsvColumns,
    columnMapping,
    setColumnMapping,
    setIsLoadingTrial,
  };
  const initCameraPhase = generatePhaseCode({
    ...shared,
    pluginName: initCameraPlugin,
    instructions: initInstructions,
  });
  const calibratePhase = generatePhaseCode({
    ...shared,
    pluginName: calibratePlugin,
    instructions: calibrateInstructions,
  });
  const validatePhase = generatePhaseCode({
    ...shared,
    pluginName: validatePlugin,
    instructions: validateInstructions,
  });
  const recalibratePhase = generatePhaseCode({
    ...shared,
    pluginName: recalibratePlugin,
    instructions: recalibrateInstructions,
  });

  const phases = [
    createPhase("initializeCamera", initCameraPlugin, initCameraPhase, true),
    createPhase("Calibrate", calibratePlugin, calibratePhase, true),
    createPhase("Validate", validatePlugin, validatePhase, true),
    createPhase("Recalibrate", recalibratePlugin, recalibratePhase, false),
  ];

  const includeInstructions = useMemo(
    () => ({
      [initCameraPlugin]: initCameraPhase.includeInstructions,
      [calibratePlugin]: calibratePhase.includeInstructions,
      [validatePlugin]: validatePhase.includeInstructions,
      [recalibratePlugin]: recalibratePhase.includeInstructions,
    }),
    [
      calibratePhase.includeInstructions,
      calibratePlugin,
      initCameraPhase.includeInstructions,
      initCameraPlugin,
      recalibratePhase.includeInstructions,
      recalibratePlugin,
      validatePhase.includeInstructions,
      validatePlugin,
    ],
  );
  const mappedColumns = useMemo(
    () => ({
      ...initCameraPhase.columnMapping,
      ...calibratePhase.columnMapping,
      ...validatePhase.columnMapping,
      ...recalibratePhase.columnMapping,
    }),
    [
      calibratePhase.columnMapping,
      initCameraPhase.columnMapping,
      recalibratePhase.columnMapping,
      validatePhase.columnMapping,
    ],
  );
  const trialCode = useMemo(
    () =>
      initCameraPhase.trialCode +
      calibratePhase.trialCode +
      validatePhase.trialCode +
      recalibratePhase.trialCode,
    [
      calibratePhase.trialCode,
      initCameraPhase.trialCode,
      recalibratePhase.trialCode,
      validatePhase.trialCode,
    ],
  );

  return {
    includeInstructions,
    mappedColumns,
    minimumPercentAcceptable: recalibratePhase.minimumPercentAcceptable,
    phases,
    recalibratePhase,
    recalibratePlugin,
    trialCode,
  };
}

type Phase = ReturnType<typeof generatePhaseCode>;

function createPhase(
  id: string,
  pluginName: string,
  phase: Phase,
  includeData: boolean,
) {
  return {
    id,
    pluginName,
    ...(includeData ? { data: phase.data } : {}),
    columnMapping: phase.columnMapping,
    setColumnMapping: phase.setColumnMapping,
    includeInstructions: phase.includeInstructions,
    setIncludeInstructions: phase.setIncludeInstructions,
    fieldGroups: phase.fieldGroups,
    trialCode: phase.trialCode,
  };
}
