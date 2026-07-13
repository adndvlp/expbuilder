import { vi } from "vitest";
import { trialsState } from "./state";

vi.mock("../../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => trialsState.value,
}));

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader",
  () => ({
    loadPluginParameters: vi.fn(async () => ({
      parameters: [{ key: "duration", label: "Duration", type: "number" }],
    })),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/Modal",
  () => ({
    default: ({
      isOpen,
      onClose,
      children,
    }: {
      isOpen: boolean;
      onClose: () => void;
      children: React.ReactNode;
    }) =>
      isOpen ? (
        <div data-testid="modal-shell">
          {children}
          <button onClick={onClose}>modal close</button>
        </div>
      ) : null,
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/useLoadData",
  () => ({
    default: vi.fn(),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchedTrialLayout",
  () => ({
    default: ({
      conditions,
      data,
      error,
      loading,
      selectedTrial,
      targetTrialParameters,
      targetTrialCsvColumns,
      onClose,
      handleSaveConditions,
      setConditions,
      loadTargetTrialParameters,
      findTrialByIdSync,
      getAvailableTrials,
    }: any) => (
      <div data-testid="branched-layout">
        <div>layout-trial:{selectedTrial?.id}</div>
        <div>layout-conditions:{conditions.length}</div>
        <div>layout-data:{data.length}</div>
        <div>layout-loading:{String(loading)}</div>
        <div>layout-error:{error || "none"}</div>
        <div>layout-params:{Object.keys(targetTrialParameters).join(",")}</div>
        <div>layout-csv:{Object.keys(targetTrialCsvColumns).join(",")}</div>
        <button onClick={() => loadTargetTrialParameters("trial-a")}>
          load target trial
        </button>
        <button onClick={() => loadTargetTrialParameters("loop_1")}>
          load target loop
        </button>
        <button onClick={() => loadTargetTrialParameters("missing-target")}>
          load missing target
        </button>
        <button onClick={() => loadTargetTrialParameters("bad-plugin")}>
          load bad plugin
        </button>
        <button onClick={() => loadTargetTrialParameters("no-plugin")}>
          load no plugin
        </button>
        <button onClick={() => setConditions([{ id: 2, rules: [] }])}>
          set branch conditions
        </button>
        <button
          onClick={() =>
            handleSaveConditions([
              { id: 1, nextTrialId: "target-a", rules: [] },
            ])
          }
        >
          save branch conditions
        </button>
        <button onClick={() => handleSaveConditions()}>
          save existing conditions
        </button>
        <button
          onClick={() =>
            handleSaveConditions([
              { id: 3, nextTrialId: "inner-future", rules: [] },
            ])
          }
        >
          save inner target
        </button>
        <button
          onClick={() =>
            handleSaveConditions([{ id: 4, nextTrialId: "inner-a", rules: [] }])
          }
        >
          save top-level loop child
        </button>
        <button
          onClick={() =>
            handleSaveConditions([
              { id: 5, nextTrialId: "unknown-target", rules: [] },
            ])
          }
        >
          save unknown target
        </button>
        <button
          onClick={() =>
            handleSaveConditions([{ id: 6, nextTrialId: null, rules: [] }])
          }
        >
          save empty target
        </button>
        <button onClick={() => onClose?.()}>close branch modal</button>
        <button onClick={() => findTrialByIdSync("trial-a")}>
          find loaded target
        </button>
        <output data-testid="available-trials">
          {JSON.stringify(getAvailableTrials())}
        </output>
      </div>
    ),
  }),
);
