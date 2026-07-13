import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import CanvasStylesBar from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/CanvasStylesBar";
import type { CanvasStyles } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const initialCanvasStyles: CanvasStyles = {
  width: 1024,
  height: 768,
  backgroundColor: "#ffffff",
  fullScreen: true,
  progressBar: false,
};

function CanvasStylesHarness({
  isDemoRunning = false,
  onRunDemo = vi.fn(),
  onStopDemo = vi.fn(),
}: {
  isDemoRunning?: boolean;
  onRunDemo?: () => void;
  onStopDemo?: () => void;
}) {
  const [canvasStyles, setCanvasStyles] = useState(initialCanvasStyles);

  return (
    <CanvasStylesBar
      canvasStyles={canvasStyles}
      setCanvasStyles={setCanvasStyles}
      stageScale={0.75}
      onRunDemo={onRunDemo}
      onStopDemo={onStopDemo}
      isDemoRunning={isDemoRunning}
    />
  );
}

describe("CanvasStylesBar", () => {
  it("applies device presets, custom dimensions and demo actions", () => {
    const onRunDemo = vi.fn();
    const onStopDemo = vi.fn();
    const { rerender } = render(
      <CanvasStylesHarness onRunDemo={onRunDemo} onStopDemo={onStopDemo} />,
    );

    expect(screen.getByText("Experiment Layout")).toBeInTheDocument();
    expect(screen.getByText("1024×768px")).toBeInTheDocument();
    expect(screen.getByText("Zoom 75%")).toBeInTheDocument();

    const laptopPreset = screen.getByTitle("Laptop — 1440 × 763");
    fireEvent.mouseEnter(laptopPreset);
    fireEvent.mouseLeave(laptopPreset);
    fireEvent.click(laptopPreset);
    expect(screen.getByText("1440×763px")).toBeInTheDocument();
    fireEvent.mouseEnter(laptopPreset);
    fireEvent.mouseLeave(laptopPreset);

    fireEvent.click(screen.getByTitle("Custom size"));
    fireEvent.change(screen.getByPlaceholderText("W"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByPlaceholderText("H"), {
      target: { value: "700" },
    });
    fireEvent.click(screen.getByText("Apply"));
    expect(screen.getByText("1440×763px")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("W"), {
      target: { value: "900" },
    });
    fireEvent.change(screen.getByPlaceholderText("H"), {
      target: { value: "700" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(screen.getByText("900×700px")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByText("Run Demo"));
    fireEvent.mouseLeave(screen.getByText("Run Demo"));
    fireEvent.click(screen.getByText("Run Demo"));
    expect(onRunDemo).toHaveBeenCalled();

    rerender(
      <CanvasStylesHarness
        isDemoRunning
        onRunDemo={onRunDemo}
        onStopDemo={onStopDemo}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("Stop Demo"));
    fireEvent.mouseLeave(screen.getByText("Stop Demo"));
    fireEvent.click(screen.getByText("Stop Demo"));
    expect(onStopDemo).toHaveBeenCalled();
  });
});
