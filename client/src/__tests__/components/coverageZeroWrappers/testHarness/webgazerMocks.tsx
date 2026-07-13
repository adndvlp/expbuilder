import { vi } from "vitest";
import { phaseState } from "./state";

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/useCsvData",
  () => ({
    useCsvData: () => ({
      csvJson: [{ stimulus: "A" }],
      setCsvJson: vi.fn(),
      csvColumns: ["stimulus", "answer"],
      setCsvColumns: vi.fn(),
    }),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useColumnMapping",
  () => ({
    useColumnMapping: () => ({
      columnMapping: phaseState.columnMapping,
      setColumnMapping: phaseState.setColumnMapping,
    }),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/InstructionsArrays",
  () => ({
    default: () => ({
      initCameraInstructions: [{ key: "init_text", default: "Init" }],
      calibrateInstructions: [{ key: "cal_text", default: "Calibrate" }],
      validateInstructions: [{ key: "validate_text", default: "Validate" }],
      recalibrateInstructions: [{ key: "recal_text", default: "Recalibrate" }],
    }),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/generatePhaseCode",
  () => ({
    generatePhaseCode: ({ pluginName, instructions }: any) => ({
      data: [{ key: `${pluginName}_data` }],
      columnMapping: {
        [`${pluginName}_param`]: { source: "typed", value: "mapped" },
      },
      setColumnMapping: phaseState.setColumnMapping,
      includeInstructions: pluginName === "plugin-webgazer-init-camera",
      setIncludeInstructions: phaseState.setIncludeInstructions,
      fieldGroups: {
        instructions,
        parameters:
          pluginName === "plugin-webgazer-recalibrate"
            ? []
            : [{ key: `${pluginName}_param`, label: "Param", type: "string" }],
      },
      trialCode: phaseState.trialCode(pluginName),
      minimumPercentAcceptable: 66,
      setMinimumPercentAcceptable: phaseState.setMinimumPercentAcceptable,
    }),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialMetaConfig",
  () => ({
    default: ({ trialName, setTrialName, onSave }: any) => (
      <div>
        <input
          aria-label="trial name"
          value={trialName}
          onChange={(event) => setTrialName(event.target.value)}
        />
        <button onClick={onSave}>save trial name</button>
      </div>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/Instructions",
  () => ({
    default: ({ includeInstructions, setIncludeInstructions, onSave }: any) => (
      <div>
        <button onClick={() => setIncludeInstructions(!includeInstructions)}>
          toggle instructions
        </button>
        <button onClick={() => onSave("stale", undefined)}>
          clear instruction mapping
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper",
  () => ({
    default: ({ pluginName, onSave }: any) => (
      <button
        onClick={() =>
          onSave(`${pluginName}_param`, { source: "typed", value: "new" })
        }
      >
        map {pluginName}
      </button>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialActions",
  () => ({
    default: ({ onSave, canSave, onDelete }: any) => (
      <div>
        <button disabled={!canSave} onClick={onSave}>
          save webgazer
        </button>
        <button onClick={onSave}>force save webgazer</button>
        <button onClick={onDelete}>delete webgazer</button>
      </div>
    ),
  }),
);
