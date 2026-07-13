import { registerBranchedWrapperLifecycle, selectedTrial } from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("coverage branched wrappers: BranchedTrialLayout", () => {
  registerBranchedWrapperLifecycle();
  it("renders loading, error, branch and params states", async () => {
    vi.doMock(
      "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions",
      () => ({
        default: ({ conditions }: { conditions: unknown[] }) => (
          <div data-testid="branch-conditions">{conditions.length}</div>
        ),
      }),
    );
    vi.doMock(
      "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride",
      () => ({
        default: ({ selectedTrial }: { selectedTrial: any }) => (
          <div data-testid="params-override">{selectedTrial.id}</div>
        ),
      }),
    );
    const BranchedTrialLayout = (
      await import(
        "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchedTrialLayout"
      )
    ).default;
    const save = vi.fn();
    const baseProps = {
      data: [],
      conditions: [{ id: 1, rules: [] }],
      selectedTrial: selectedTrial(),
      error: null,
      loading: false,
      targetTrialParameters: {},
      targetTrialCsvColumns: {},
      onClose: vi.fn(),
      handleSaveConditions: save,
      setConditions: vi.fn(),
      loadTargetTrialParameters: vi.fn(async () => {}),
      findTrialByIdSync: vi.fn(),
      getAvailableTrials: vi.fn(() => []),
    };

    const { rerender } = render(
      <BranchedTrialLayout {...baseProps} loading error={null} />,
    );
    expect(screen.getByText("Loading data fields...")).toBeInTheDocument();

    rerender(
      <BranchedTrialLayout {...baseProps} loading={false} error="Broken" />,
    );
    expect(screen.getByText(/Broken/)).toBeInTheDocument();

    rerender(<BranchedTrialLayout {...baseProps} />);
    expect(screen.getByTestId("branch-conditions")).toHaveTextContent("1");
    fireEvent.mouseEnter(screen.getByText("Branch & Jump Conditions"));
    fireEvent.mouseLeave(screen.getByText("Branch & Jump Conditions"));
    fireEvent.mouseEnter(screen.getByText("Save configuration"));
    fireEvent.mouseLeave(screen.getByText("Save configuration"));
    fireEvent.click(screen.getByText("Save configuration"));
    expect(save).toHaveBeenCalled();

    fireEvent.mouseEnter(screen.getByText("Params Override"));
    fireEvent.mouseLeave(screen.getByText("Params Override"));
    fireEvent.click(screen.getByText("Params Override"));
    expect(screen.getByTestId("params-override")).toHaveTextContent("current");

    fireEvent.mouseEnter(screen.getByText("Params Override"));
    fireEvent.mouseLeave(screen.getByText("Params Override"));
    fireEvent.mouseEnter(screen.getByText("Branch & Jump Conditions"));
    fireEvent.mouseLeave(screen.getByText("Branch & Jump Conditions"));
    fireEvent.click(screen.getByText("Branch & Jump Conditions"));
    expect(screen.getByTestId("branch-conditions")).toHaveTextContent("1");
  });
});
