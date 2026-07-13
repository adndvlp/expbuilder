import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  LoopsConfigHarness,
  makeLoop,
  mocks,
  installTrialsContext,
} from "./testHarness";

describe("LoopsConfig persistence, indicators and deletion", () => {
  it("closes the conditional loop modal when clicking the backdrop", async () => {
    const loop = makeLoop({
      isConditionalLoop: true,
      loopConditions: [
        { id: 1, rules: [{ trialId: 1, column: "rt", op: ">", value: "500" }] },
      ],
    });

    render(<LoopsConfigHarness loop={loop} />);

    fireEvent.click(await screen.findByText("Edit Loop Conditions (1)"));
    const modalButton = screen.getByText("Save Conditional Loop");
    fireEvent.click(modalButton.parentElement!.parentElement!.parentElement!);

    expect(screen.queryByText("Save Conditional Loop")).not.toBeInTheDocument();
  });

  it("clears the field save indicator after its timeout", async () => {
    render(<LoopsConfigHarness loop={makeLoop()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save loop" })).toBeEnabled();
    });
    vi.useFakeTimers();

    const repetitionsInput = screen.getByPlaceholderText("1");
    fireEvent.change(repetitionsInput, { target: { value: "" } });
    expect(repetitionsInput).toHaveValue(1);
    fireEvent.change(repetitionsInput, { target: { value: "3" } });
    fireEvent.blur(repetitionsInput);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
      "loop_1",
      "repetitions",
      3,
    );

    expect(screen.getByText(/Saved \(repetitions\)/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
  });

  it("clears a pending save indicator timeout on unmount", async () => {
    const { unmount } = render(<LoopsConfigHarness loop={makeLoop()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save loop" })).toBeEnabled();
    });

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Save Orders" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Saved \(orders\)/)).toBeInTheDocument();
    unmount();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
  });

  it("saves repetitions on blur and persists the full loop on manual save", async () => {
    mocks.csvState.csvJson = [{ stimulus: "A" }];
    mocks.csvState.csvColumns = ["stimulus"];
    const loop = makeLoop({ orders: true, orderColumns: ["order_a"] });

    render(<LoopsConfigHarness loop={loop} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save loop" })).toBeEnabled();
    });

    const repetitionsInput = screen.getByPlaceholderText("1");
    fireEvent.change(repetitionsInput, { target: { value: "4" } });
    fireEvent.blur(repetitionsInput);

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
        "loop_1",
        "repetitions",
        4,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Save loop" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_1",
        expect.objectContaining({
          repetitions: 4,
          randomize: false,
          csvJson: [{ stimulus: "A" }],
          csvColumns: ["stimulus"],
          orders: true,
          orderColumns: ["order_a"],
        }),
      );
    });
  });

  it("confirms before deleting the loop", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<LoopsConfigHarness loop={makeLoop()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete loop" }));

    await waitFor(() => {
      expect(mocks.trialsContext.deleteLoop).toHaveBeenCalledWith("loop_1");
    });
  });

  it("does not delete the loop when deletion is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<LoopsConfigHarness loop={makeLoop()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete loop" }));

    expect(mocks.trialsContext.deleteLoop).not.toHaveBeenCalled();
  });

  it("logs manual save and delete failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    installTrialsContext({
      updateLoop: vi.fn(async () => {
        throw new Error("save failed");
      }),
      deleteLoop: vi.fn(async () => {
        throw new Error("delete failed");
      }),
    });

    render(<LoopsConfigHarness loop={makeLoop()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save loop" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save loop" }));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error saving loop:",
        expect.any(Error),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete loop" }));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error deleting loop:",
        expect.any(Error),
      );
    });
  });
});
