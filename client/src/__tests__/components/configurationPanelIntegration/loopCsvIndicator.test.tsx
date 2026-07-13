import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoopCsvIndicator from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/components/LoopCsvIndicator";

vi.mock("react-switch", () => ({
  default: ({ onChange }: { onChange: (checked: boolean) => void }) => (
    <button
      aria-label="CSV loop indicator"
      type="button"
      onClick={() => onChange(true)}
    />
  ),
}));

describe("LoopCsvIndicator", () => {
  it("hides missing and empty CSV data and renders populated loop data", () => {
    const loop = {
      id: "loop-1",
      name: "Loop",
      trials: [],
    } as any;
    const { rerender } = render(<LoopCsvIndicator parentLoop={loop} />);
    expect(screen.queryByText("Using CSV from loop")).not.toBeInTheDocument();

    rerender(<LoopCsvIndicator parentLoop={{ ...loop, csvJson: [] }} />);
    expect(screen.queryByText("Using CSV from loop")).not.toBeInTheDocument();

    rerender(
      <LoopCsvIndicator
        parentLoop={{ ...loop, csvJson: [{ stimulus: "A" }] }}
      />,
    );
    expect(screen.getByText("Using CSV from loop")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "CSV loop indicator" }));
    expect(screen.getByText("Using CSV from loop")).toBeInTheDocument();
  });
});
