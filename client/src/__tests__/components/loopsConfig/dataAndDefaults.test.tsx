import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  LoopsConfigHarness,
  makeLoop,
  mocks,
  installTrialsContext,
} from "./testHarness";
import type { Loop } from "./testHarness";

describe("LoopsConfig data loading and defaults", () => {
  it("loads loop CSV, orders and categories into child controls", () => {
    const loop = makeLoop({
      csvJson: [{ stimulus: "A", order_a: "1", category: "practice" }],
      csvColumns: ["stimulus", "order_a", "category"],
      orders: true,
      orderColumns: ["order_a"],
      categories: true,
      categoryColumn: "category",
    });

    render(<LoopsConfigHarness loop={loop} />);

    expect(mocks.csvState.setCsvJson).toHaveBeenCalledWith(loop.csvJson);
    expect(mocks.csvState.setCsvColumns).toHaveBeenCalledWith(loop.csvColumns);
    expect(mocks.lastOrdersProps.orders).toBe(true);
    expect(mocks.lastOrdersProps.categories).toBe(true);
    expect(mocks.lastOrdersProps.columnOptions).toEqual([]);
  });

  it("saves uploaded loop CSV data and propagates csvFromLoop to loop trials", async () => {
    render(<LoopsConfigHarness loop={makeLoop()} />);

    fireEvent.click(screen.getByRole("button", { name: "Upload CSV" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
        "loop_1",
        "csvJson",
        [
          { stimulus: "A", order_a: "1", category: "practice" },
          { stimulus: "B", order_a: "2", category: "main" },
        ],
        false,
      );
    });
    expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
      "loop_1",
      "csvColumns",
      ["stimulus", "order_a", "category"],
      false,
    );
    expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
      1,
      "csvFromLoop",
      true,
      false,
    );
    expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
      2,
      "csvFromLoop",
      true,
      false,
    );
  });

  it("handles guard paths when no loop is selected", () => {
    const firstRender = render(<LoopsConfigHarness />);

    const saveButton = screen.getByRole("button", { name: "Save loop" });
    (saveButton as HTMLButtonElement).disabled = false;
    fireEvent.click(saveButton);
    fireEvent.blur(screen.getByPlaceholderText("1"));
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    fireEvent.click(switches[1]);
    fireEvent.click(screen.getByRole("button", { name: "Delete CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Orders" }));
    expect(mocks.csvState.setCsvJson).not.toHaveBeenCalled();
    expect(mocks.trialsContext.updateLoop).not.toHaveBeenCalled();
    expect(mocks.trialsContext.updateLoopField).not.toHaveBeenCalled();

    firstRender.unmount();
    mocks.csvState.csvJson = [{ stimulus: "A" }];
    mocks.csvState.csvColumns = ["stimulus"];

    render(<LoopsConfigHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Delete CSV" }));

    expect(mocks.csvState.setCsvJson).toHaveBeenCalledWith([]);
    expect(mocks.csvState.setCsvColumns).toHaveBeenCalledWith([]);
    expect(mocks.trialsContext.updateLoopField).not.toHaveBeenCalled();
  });

  it("falls back to default loop state when optional loop fields are absent", () => {
    render(
      <LoopsConfigHarness
        loop={
          {
            id: "loop_sparse",
            name: "Sparse Loop",
            type: "loop",
            code: "",
          } as unknown as Loop
        }
      />,
    );

    expect(mocks.csvState.setCsvJson).toHaveBeenCalledWith([]);
    expect(mocks.csvState.setCsvColumns).toHaveBeenCalledWith([]);
    expect(mocks.lastOrdersProps.orders).toBe(false);
    expect(mocks.lastOrdersProps.categories).toBe(false);
    expect(screen.getByText(/0 trial\(s\)/)).toBeInTheDocument();
  });

  it("handles unsuccessful field and orders saves without showing success", async () => {
    installTrialsContext({
      updateLoopField: vi.fn(async () => false),
      updateLoop: vi.fn(async () => null),
    });

    render(<LoopsConfigHarness loop={makeLoop()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save loop" })).toBeEnabled();
    });

    fireEvent.click(screen.getAllByRole("switch")[0]);
    await waitFor(() => {
      expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
        "loop_1",
        "randomize",
        true,
      );
    });
    expect(screen.queryByText(/Saved \(randomize\)/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Orders" }));
    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_1",
        expect.objectContaining({ orders: true }),
      );
    });
    expect(screen.queryByText(/Saved \(orders\)/)).not.toBeInTheDocument();
  });

  it("saves empty CSV fallbacks without propagating when a loop has no trials", async () => {
    mocks.csvState.csvJson = undefined as any;
    mocks.csvState.csvColumns = undefined as any;
    mocks.csvState.handleCsvUpload = vi.fn((_event, onDataLoaded) => {
      onDataLoaded(undefined, undefined);
    });

    render(<LoopsConfigHarness loop={makeLoop({ trials: [] })} />);

    fireEvent.click(screen.getByRole("button", { name: "Upload CSV" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
        "loop_1",
        "csvJson",
        [],
        false,
      );
    });
    expect(mocks.trialsContext.updateLoopField).toHaveBeenCalledWith(
      "loop_1",
      "csvColumns",
      [],
      false,
    );
    expect(mocks.trialsContext.updateTrialField).not.toHaveBeenCalled();
  });
});
