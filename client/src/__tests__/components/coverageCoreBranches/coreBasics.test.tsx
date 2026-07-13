import { act, fireEvent, render, screen } from "@testing-library/react";
import { useContext, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "../../../pages/ExperimentBuilder/components/ErrorBoundary";
import TrialsContext from "../../../pages/ExperimentBuilder/contexts/TrialsContext";

function TrialsContextProbe() {
  const ctx = useContext(TrialsContext);
  const [result, setResult] = useState("");

  return (
    <div>
      <div data-testid="context-state">
        {ctx.timeline.length}:{ctx.loopTimeline.length}:
        {String(ctx.activeLoopId)}:{String(ctx.isLoading)}
      </div>
      <button
        type="button"
        onClick={async () => {
          ctx.setSelectedTrial(null);
          ctx.setSelectedLoop(null);
          const values = [
            await ctx.createTrial({ name: "trial" } as any),
            await ctx.getTrial("trial"),
            await ctx.updateTrial("trial", {} as any),
            await ctx.updateTrialField("trial", "name", "new"),
            await ctx.deleteTrial("trial"),
            await ctx.createLoop({ name: "loop" } as any),
            await ctx.getLoop("loop"),
            await ctx.updateLoop("loop", {} as any),
            await ctx.updateLoopField("loop", "name", "new"),
            await ctx.deleteLoop("loop"),
            await ctx.updateTimeline([]),
            await ctx.getTimeline(),
            await ctx.getLoopTimeline("loop", true, true),
            ctx.clearLoopTimeline(),
            await ctx.deleteAllTrials(),
          ];
          setResult(JSON.stringify(values));
        }}
      >
        run defaults
      </button>
      <output>{result}</output>
    </div>
  );
}

describe("coverage core branches: context and boundary", () => {
  it("executes every default TrialsContext callback", async () => {
    render(<TrialsContextProbe />);

    expect(screen.getByTestId("context-state")).toHaveTextContent(
      "0:0:null:false",
    );
    await act(async () => {
      fireEvent.click(screen.getByText("run defaults"));
    });

    expect(screen.getByRole("status", { hidden: true })).toBeInTheDocument();
    expect(
      screen.getByText(/\[\{},null,null,false,false,\{},null/),
    ).toBeInTheDocument();
  });

  it("renders ErrorBoundary children and fallback after a thrown render", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    function CrashingChild({ fail }: { fail: boolean }) {
      if (fail) throw new Error("boom");
      return <div>child ok</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <CrashingChild fail={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("child ok")).toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <CrashingChild fail />
      </ErrorBoundary>,
    );

    expect(screen.getByText("⚠️ Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/Please reload the page/)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
