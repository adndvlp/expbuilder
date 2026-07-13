import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoopsConfigHarness, makeLoop, mocks } from "./testHarness";

describe("LoopsConfig CSV, ordering and conditions", () => {
  it("deletes loop CSV data and clears csvFromLoop from loop trials", async () => {
    mocks.csvState.csvJson = [{ stimulus: "A" }];
    mocks.csvState.csvColumns = ["stimulus"];

    render(
      <LoopsConfigHarness
        loop={makeLoop({
          csvJson: [{ stimulus: "A" }],
          csvColumns: ["stimulus"],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete CSV" }));

    await waitFor(() => {
      expect(mocks.csvState.setCsvJson).toHaveBeenCalledWith([]);
    });
    expect(mocks.csvState.setCsvColumns).toHaveBeenCalledWith([]);
    expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
      "loop_1",
      "csvJson",
      [],
      false,
    );
    expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
      "loop_1",
      "csvColumns",
      [],
      false,
    );
    expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
      1,
      "csvFromLoop",
      false,
      false,
    );
  });

  it("saves orders and categories through one updateLoop call", async () => {
    render(<LoopsConfigHarness loop={makeLoop()} />);

    fireEvent.click(screen.getByRole("button", { name: "Save Orders" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop_1", {
        orders: true,
        orderColumns: ["order_a"],
        stimuliOrders: [[0, 1, 2]],
        categories: true,
        categoryColumn: "category",
        categoryData: ["practice", "main"],
      });
    });
  });

  it("saves randomize and conditional loop switch changes", async () => {
    render(<LoopsConfigHarness loop={makeLoop()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save loop" })).toBeEnabled();
    });

    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(switches[0]);
    await waitFor(() => {
      expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
        "loop_1",
        "randomize",
        true,
      );
    });

    fireEvent.click(switches[1]);
    await waitFor(() => {
      expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
        "loop_1",
        "isConditionalLoop",
        true,
      );
    });

    fireEvent.click(screen.getByText("Configure Loop Conditions"));
    fireEvent.click(screen.getByText("Save Conditional Loop"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop_1", {
        loopConditions: [
          {
            id: 1,
            rules: [{ trialId: 1, column: "rt", op: ">", value: "500" }],
          },
        ],
        isConditionalLoop: true,
      });
    });

    fireEvent.click(screen.getByText("Close Conditional Loop"));
    expect(screen.queryByText("Save Conditional Loop")).not.toBeInTheDocument();

    fireEvent.click(switches[1]);
    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop_1", {
        isConditionalLoop: false,
        loopConditions: [],
      });
    });
  });
});
