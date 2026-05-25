import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import LoopsConfig from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration";
import type { Loop } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  csvState: {
    csvJson: [] as any[],
    csvColumns: [] as string[],
    setCsvJson: vi.fn(),
    setCsvColumns: vi.fn(),
    handleCsvUpload: vi.fn(),
  },
  lastOrdersProps: undefined as any,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/useCsvData",
  () => ({
    useCsvData: () => mocks.csvState,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/CsvUploader",
  () => ({
    default: ({ onCsvUpload, onDeleteCSV, csvJson }: any) => (
      <div data-testid="csv-uploader">
        <span data-testid="csv-rows">{csvJson.length}</span>
        <button type="button" onClick={() => onCsvUpload({ target: { files: [] } })}>
          Upload CSV
        </button>
        <button type="button" onClick={onDeleteCSV}>
          Delete CSV
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/OrdersAndCategories",
  () => ({
    default: (props: any) => {
      mocks.lastOrdersProps = props;
      return (
        <div data-testid="orders-categories">
          <button
            type="button"
            onClick={() =>
              props.onSave(
                true,
                ["order_a"],
                [[0, 1, 2]],
                true,
                "category",
                ["practice", "main"],
              )
            }
          >
            Save Orders
          </button>
        </div>
      );
    },
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop",
  () => ({
    default: ({ onSave }: any) => (
      <button
        type="button"
        onClick={() =>
          onSave([{ id: 1, rules: [{ trialId: 1, column: "rt", op: ">", value: "500" }] }])
        }
      >
        Save Conditional Loop
      </button>
    ),
  }),
);

function makeLoop(overrides: Partial<Loop> = {}): Loop {
  return {
    id: "loop_1",
    name: "Training Loop",
    repetitions: 2,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    orderColumns: [],
    categories: false,
    categoryColumn: "",
    categoryData: [],
    trials: [1, 2],
    code: "",
    csvJson: [],
    csvColumns: [],
    loopConditions: [],
    isConditionalLoop: false,
    ...overrides,
  };
}

function installTrialsContext(overrides: Partial<any> = {}) {
  mocks.trialsContext = {
    updateLoop: vi.fn(async (id: string | number, data: unknown) => ({
      id,
      ...(data as object),
    })),
    updateLoopField: vi.fn(async () => true),
    deleteLoop: vi.fn(async () => true),
    updateTrialField: vi.fn(async () => true),
    ...overrides,
  };
}

describe("LoopsConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installTrialsContext();
    mocks.csvState.csvJson = [];
    mocks.csvState.csvColumns = [];
    mocks.csvState.setCsvJson = vi.fn();
    mocks.csvState.setCsvColumns = vi.fn();
    mocks.csvState.handleCsvUpload = vi.fn((_event, onDataLoaded) => {
      onDataLoaded(
        [
          { stimulus: "A", order_a: "1", category: "practice" },
          { stimulus: "B", order_a: "2", category: "main" },
        ],
        ["stimulus", "order_a", "category"],
      );
    });
    mocks.lastOrdersProps = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads loop CSV, orders and categories into child controls", () => {
    const loop = makeLoop({
      csvJson: [{ stimulus: "A", order_a: "1", category: "practice" }],
      csvColumns: ["stimulus", "order_a", "category"],
      orders: true,
      orderColumns: ["order_a"],
      categories: true,
      categoryColumn: "category",
    });

    render(<LoopsConfig loop={loop} />);

    expect(mocks.csvState.setCsvJson).toHaveBeenCalledWith(loop.csvJson);
    expect(mocks.csvState.setCsvColumns).toHaveBeenCalledWith(loop.csvColumns);
    expect(mocks.lastOrdersProps.orders).toBe(true);
    expect(mocks.lastOrdersProps.categories).toBe(true);
    expect(mocks.lastOrdersProps.columnOptions).toEqual([]);
  });

  it("saves uploaded loop CSV data and propagates csvFromLoop to loop trials", async () => {
    render(<LoopsConfig loop={makeLoop()} />);

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

  it("deletes loop CSV data and clears csvFromLoop from loop trials", async () => {
    mocks.csvState.csvJson = [{ stimulus: "A" }];
    mocks.csvState.csvColumns = ["stimulus"];

    render(
      <LoopsConfig
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
    render(<LoopsConfig loop={makeLoop()} />);

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

  it("saves repetitions on blur and persists the full loop on manual save", async () => {
    mocks.csvState.csvJson = [{ stimulus: "A" }];
    mocks.csvState.csvColumns = ["stimulus"];
    const loop = makeLoop({ orders: true, orderColumns: ["order_a"] });

    render(<LoopsConfig loop={loop} />);

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

    render(<LoopsConfig loop={makeLoop()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete loop" }));

    await waitFor(() => {
      expect(mocks.trialsContext.deleteLoop).toHaveBeenCalledWith("loop_1");
    });
  });
});
