import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DefaultDestination from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/DefaultDestination";
import { trial } from "../helpers/trialFactories";
import type { Condition } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/types";

const mocks = vi.hoisted(() => ({
  getTrial: vi.fn(),
  updateTrial: vi.fn(),
  updateLoop: vi.fn(),
}));
vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks,
}));

const candidates = [{ id: 2, name: "Next trial" }];
const conditions: Condition[] = [
  {
    id: 1,
    rules: [{ column: "response", op: "==", value: "yes" }],
    nextTrialId: 2,
  },
];

describe("default destination termination options", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    {
      parentLoopId: null,
      defaultNextTrialId: null,
      selected: "FINISH_EXPERIMENT",
    },
    {
      parentLoopId: undefined,
      defaultNextTrialId: "FINISH_EXPERIMENT",
      selected: "FINISH_EXPERIMENT",
    },
    { parentLoopId: null, defaultNextTrialId: 2, selected: "2" },
    { parentLoopId: "loop", defaultNextTrialId: null, selected: "" },
    {
      parentLoopId: "nested-loop",
      defaultNextTrialId: "FINISH_EXPERIMENT",
      selected: "FINISH_EXPERIMENT",
    },
    { parentLoopId: "loop", defaultNextTrialId: 2, selected: "2" },
  ])(
    "shows the correct actions for $parentLoopId with default $defaultNextTrialId",
    ({ selected, ...context }) => {
      render(
        <DefaultDestination
          trial={trial(context)}
          candidates={candidates}
          conditions={conditions}
        />,
      );
      const selector = screen.getByRole("combobox", {
        name: "Default destination",
      });
      expect(
        screen.getAllByRole("option", { name: "Finish experiment" }),
      ).toHaveLength(1);
      expect(
        screen.getByRole("option", { name: "Next trial" }),
      ).toBeInTheDocument();
      expect(
        Boolean(screen.queryByRole("option", { name: "End this route" })),
      ).toBe(context.parentLoopId != null);
      expect(selector).toHaveValue(selected);
      expect(mocks.getTrial).not.toHaveBeenCalled();
      expect(mocks.updateTrial).not.toHaveBeenCalled();
    },
  );

  it("updates the actions when the trial changes containment", () => {
    const source = trial({ parentLoopId: "loop", defaultNextTrialId: null });
    const { rerender } = render(
      <DefaultDestination
        trial={source}
        candidates={candidates}
        conditions={[]}
      />,
    );
    rerender(
      <DefaultDestination
        trial={{ ...source, parentLoopId: null }}
        candidates={candidates}
        conditions={[]}
      />,
    );
    expect(
      screen.queryByRole("option", { name: "End this route" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("FINISH_EXPERIMENT");
    rerender(
      <DefaultDestination
        trial={source}
        candidates={candidates}
        conditions={[]}
      />,
    );
    expect(
      screen.getByRole("option", { name: "End this route" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(mocks.updateTrial).not.toHaveBeenCalled();
  });

  it.each([
    {
      parentLoopId: null,
      defaultNextTrialId: 2,
      selection: "FINISH_EXPERIMENT",
      saved: "FINISH_EXPERIMENT",
    },
    {
      parentLoopId: "loop",
      defaultNextTrialId: "FINISH_EXPERIMENT",
      selection: "",
      saved: null,
    },
    {
      parentLoopId: null,
      defaultNextTrialId: null,
      selection: "2",
      saved: "2",
    },
    {
      parentLoopId: "loop",
      defaultNextTrialId: null,
      selection: "2",
      saved: "2",
    },
  ])(
    "saves $selection in $parentLoopId while preserving conditions",
    async ({ selection, saved, ...context }) => {
      const source = trial({ ...context, branches: [2] });
      mocks.getTrial.mockResolvedValue(source);
      render(
        <DefaultDestination
          trial={source}
          candidates={candidates}
          conditions={conditions}
        />,
      );
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: selection },
      });
      await waitFor(() =>
        expect(mocks.updateTrial).toHaveBeenCalledWith(source.id, {
          branches: [2],
          branchConditions: conditions,
          defaultNextTrialId: saved,
        }),
      );
      expect(mocks.updateLoop).not.toHaveBeenCalled();
    },
  );
});
