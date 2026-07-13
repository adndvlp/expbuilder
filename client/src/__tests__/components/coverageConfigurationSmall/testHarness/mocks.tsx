import { vi } from "vitest";
import { asyncMocks } from "./state";

vi.mock("react-switch", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    default: ({ checked, onChange, id }: any) =>
      React.createElement(
        "button",
        {
          type: "button",
          id,
          role: "switch",
          "aria-checked": checked,
          onClick: () => onChange(!checked),
        },
        checked ? "on" : "off",
      ),
  };
});

vi.mock(
  "../../../../pages/ExperimentBuilder/components/CodeEditorModal",
  () => ({
    default: ({ isOpen, title, tabs, onClose }: any) =>
      isOpen ? (
        <section role="dialog" aria-label={title}>
          {tabs.map((tab: any) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => tab.onChange(`${tab.value} updated`)}
            >
              {tab.label}
            </button>
          ))}
          <button type="button" onClick={onClose}>
            Close modal
          </button>
        </section>
      ) : null,
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner",
  () => ({
    default: ({ isOpen, onSave, onAutoSave, onClose }: any) =>
      isOpen ? (
        <div data-testid="trial-designer">
          <button type="button" onClick={() => onAutoSave({ components: [] })}>
            Auto save designer
          </button>
          <button type="button" onClick={() => onSave({ saved: true })}>
            Save designer
          </button>
          <button type="button" onClick={onClose}>
            Close designer
          </button>
        </div>
      ) : null,
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper",
  () => ({
    default: ({ parameters, onSave }: any) => (
      <div data-testid="parameter-mapper">
        <span>{parameters.map((p: any) => p.key).join(",")}</span>
        <button type="button" onClick={() => onSave("difficulty", "hard")}>
          Save mapper
        </button>
      </div>
    ),
  }),
);

vi.mock("../../../../pages/ExperimentBuilder/components/ResultsList", () => ({
  default: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="results-list">{activeTab}</div>
  ),
}));

vi.mock("../../../../pages/ExperimentPanel/ExperimentSettings", () => ({
  default: ({ experimentID }: { experimentID?: string }) => (
    <div data-testid="experiment-settings">{experimentID}</div>
  ),
}));

vi.mock("../../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  fetchExperimentNameByID: asyncMocks.fetchExperimentNameByID,
}));
