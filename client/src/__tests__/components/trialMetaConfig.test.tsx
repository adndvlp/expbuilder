import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrialMetaConfig from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialMetaConfig";

const mocks = vi.hoisted(() => ({
  timeline: [] as Array<{ id: number | string; name: string }>,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => ({ timeline: mocks.timeline }),
}));

describe("TrialMetaConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.timeline = [
      { id: 1, name: "Existing Trial" },
      { id: 2, name: "Current Trial" },
    ];
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("updates unique names and saves on blur", () => {
    const setTrialName = vi.fn();
    const onSave = vi.fn();

    render(
      <TrialMetaConfig
        trialName="Current Trial"
        setTrialName={setTrialName}
        selectedTrial={{ id: 2 }}
        setSelectedTrial={vi.fn()}
        onSave={onSave}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    expect(setTrialName).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Updated Trial" } });
    fireEvent.blur(input);

    expect(setTrialName).toHaveBeenCalledWith("Updated Trial");
    expect(onSave).toHaveBeenCalled();
  });

  it("blocks duplicate names from other trials", () => {
    const setTrialName = vi.fn();

    render(
      <TrialMetaConfig
        trialName="Current Trial"
        setTrialName={setTrialName}
        selectedTrial={{ id: 2 }}
        setSelectedTrial={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Existing Trial" },
    });

    expect(window.alert).toHaveBeenCalledWith(
      "It already exists a trial name with that name.",
    );
    expect(setTrialName).not.toHaveBeenCalled();
  });

  it("clears the default name on focus and skips empty-name saves", () => {
    const setTrialName = vi.fn();
    const onSave = vi.fn();

    const { rerender } = render(
      <TrialMetaConfig
        trialName="New Trial"
        setTrialName={setTrialName}
        selectedTrial={{ id: 3 }}
        setSelectedTrial={vi.fn()}
        onSave={onSave}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    expect(setTrialName).toHaveBeenCalledWith("");

    rerender(
      <TrialMetaConfig
        trialName=""
        setTrialName={setTrialName}
        selectedTrial={{ id: 3 }}
        setSelectedTrial={vi.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
  });
});
