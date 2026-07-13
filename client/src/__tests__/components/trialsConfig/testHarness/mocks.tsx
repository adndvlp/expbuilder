import { vi } from "vitest";
import { mocks } from "./state";

vi.mock("../../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/hooks/usePluginParameters",
  () => ({
    usePluginParameters: () => ({
      parameters: mocks.pluginParameters,
      data: mocks.pluginData,
      loading: false,
      error: null,
    }),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/Timeline/useFileUpload",
  () => ({
    useFileUpload: () => ({
      uploadedFiles: mocks.uploadedFiles,
    }),
  }),
);

vi.mock("react-switch", () => ({
  default: ({ checked, onChange, disabled }: any) => (
    <button
      type="button"
      data-testid={disabled ? "disabled-switch" : "switch"}
      onClick={() => onChange(!checked)}
    >
      switch {String(checked)}
    </button>
  ),
}));

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators",
  () => ({
    generateInitializeCode: (code: string) =>
      code.trim() ? `initialize generated ${code}` : "",
    generateOnLoadCode: (code: string) =>
      code.trim() ? `on_load generated ${code}` : "",
    generateOnStartCode: ({ customOnStart, getVarName }: any) => {
      const varName = getVarName("BranchCustomParameters");
      return customOnStart?.trim() ? `on_start generated ${varName}` : "";
    },
    generateOnFinishCode: ({ customOnFinish, getVarName, isInLoop }: any) => {
      const varName = getVarName("HasBranches");
      return customOnFinish?.trim() || isInLoop
        ? `on_finish generated ${varName}`
        : "";
    },
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper",
  () => ({
    default: (props: any) => {
      mocks.mapperProps = props;
      return (
        <div data-testid="parameter-mapper">
          <span data-testid="mapper-cols">{props.csvColumns.join(",")}</span>
          <span data-testid="mapper-stimulus">
            {props.columnMapping.stimulus?.value ?? ""}
          </span>
          <button
            type="button"
            onClick={() =>
              props.onSave("stimulus", { source: "typed", value: "<p>New</p>" })
            }
          >
            Save Stimulus Mapping
          </button>
          <button
            type="button"
            onClick={() => props.onSave("choices", undefined)}
          >
            Remove Choices Mapping
          </button>
        </div>
      );
    },
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TabContent",
  () => ({
    default: (props: any) => {
      mocks.tabContentProps = props;
      return (
        <div data-testid="tab-content">
          <button
            type="button"
            onClick={() =>
              props.saveColumnMapping("stimulus", {
                source: "typed",
                value: "<p>Dynamic</p>",
              })
            }
          >
            Save Dynamic Mapping
          </button>
          <button
            type="button"
            onClick={() => props.saveField("customOnLoad", "dynamic();")}
          >
            Save Dynamic Field
          </button>
        </div>
      );
    },
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCodeInjection",
  () => ({
    default: ({ tabs, onSave }: any) => (
      <div data-testid="trial-code-injection">
        {tabs.map((tab: any) => (
          <div key={tab.key}>
            <output data-testid={`preview-empty-${tab.key}`}>
              {tab.computePreview("")}
            </output>
            <output data-testid={`preview-custom-${tab.key}`}>
              {tab.computePreview("console.log('x');")}
            </output>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onSave("customOnFinish", "data.ok = true;")}
        >
          Save Custom Code
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Extensions",
  () => ({
    default: (props: any) => {
      mocks.extensionsProps = props;
      return (
        <button
          type="button"
          onClick={() => props.onSave(true, "jsPsychExtensionMouseTracking")}
        >
          Save Extensions
        </button>
      );
    },
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialActions",
  () => ({
    default: ({ onSave, canSave, onDelete }: any) => (
      <div>
        <button type="button" disabled={!canSave} onClick={onSave}>
          Save trial
        </button>
        <button type="button" onClick={onSave}>
          Force save
        </button>
        <button type="button" onClick={onDelete}>
          Delete trial
        </button>
      </div>
    ),
  }),
);
