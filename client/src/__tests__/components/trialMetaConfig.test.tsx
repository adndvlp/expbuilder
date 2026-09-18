import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrialMetaConfig from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialMetaConfig";

const mocks = vi.hoisted(() => ({
  timeline: [] as Array<{ id: number | string; name: string }>,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => ({ timeline: mocks.timeline }),
}));

function Harness({
  initialName,
  onSave = vi.fn(),
  selectedId = 2,
}: {
  initialName: string;
  onSave?: () => void;
  selectedId?: number;
}) {
  const [name, setName] = useState(initialName);
  return (
    <TrialMetaConfig
      trialName={name}
      setTrialName={setName}
      selectedTrial={{ id: selectedId }}
      setSelectedTrial={vi.fn()}
      onSave={onSave}
    />
  );
}

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
    const onSave = vi.fn();

    render(<Harness initialName="Current Trial" onSave={onSave} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Updated Trial" } });
    expect(input).toHaveValue("Updated Trial");
    fireEvent.blur(input);

    expect(input).toHaveValue("Updated Trial");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("warns about duplicates without blocking typing and saves once unique", () => {
    const onSave = vi.fn();

    render(<Harness initialName="Current Trial" onSave={onSave} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Existing Trial" } });

    expect(input).toHaveValue("Existing Trial");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "It already exists a trial name with that name.",
    );
    expect(window.alert).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "Existing Trial 2" } });
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.blur(input);

    expect(input).toHaveValue("Existing Trial 2");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("reverts duplicates on blur to the last valid name and skips the save", () => {
    const onSave = vi.fn();

    render(<Harness initialName="Current Trial" onSave={onSave} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Existing Trial" } });
    fireEvent.blur(input);

    expect(input).toHaveValue("Current Trial");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("clears the default name on focus, warns when empty and restores it on blur", () => {
    const onSave = vi.fn();

    render(<Harness initialName="New Trial" onSave={onSave} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    expect(input).toHaveValue("");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Trial name cannot be empty.",
    );

    fireEvent.blur(input);

    expect(input).toHaveValue("New Trial");
    expect(onSave).not.toHaveBeenCalled();
  });
});
