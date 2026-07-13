import { beforeEach, afterEach, vi } from "vitest";
import LoopsConfig from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration";
import type { Loop } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

const hoistedMocks = vi.hoisted(() => ({
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

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => hoistedMocks.trialsContext,
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/useCsvData",
  () => ({
    useCsvData: () => hoistedMocks.csvState,
  }),
);

vi.mock("react-switch", () => ({
  default: ({ checked, onChange }: any) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      switch {String(checked)}
    </button>
  ),
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/CsvUploader",
  () => ({
    default: ({ onCsvUpload, onDeleteCSV, csvJson }: any) => (
      <div data-testid="csv-uploader">
        <span data-testid="csv-rows">{csvJson?.length ?? 0}</span>
        <button
          type="button"
          onClick={() => onCsvUpload({ target: { files: [] } })}
        >
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
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/OrdersAndCategories",
  () => ({
    default: (props: any) => {
      hoistedMocks.lastOrdersProps = props;
      return (
        <div data-testid="orders-categories">
          <button
            type="button"
            onClick={() =>
              props.onSave(true, ["order_a"], [[0, 1, 2]], true, "category", [
                "practice",
                "main",
              ])
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
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop",
  () => ({
    default: ({ onSave, onClose }: any) => (
      <div>
        <button
          type="button"
          onClick={() =>
            onSave([
              {
                id: 1,
                rules: [{ trialId: 1, column: "rt", op: ">", value: "500" }],
              },
            ])
          }
        >
          Save Conditional Loop
        </button>
        <button type="button" onClick={onClose}>
          Close Conditional Loop
        </button>
      </div>
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
  hoistedMocks.trialsContext = {
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

beforeEach(() => {
  vi.clearAllMocks();
  installTrialsContext();
  hoistedMocks.csvState.csvJson = [];
  hoistedMocks.csvState.csvColumns = [];
  hoistedMocks.csvState.setCsvJson = vi.fn();
  hoistedMocks.csvState.setCsvColumns = vi.fn();
  hoistedMocks.csvState.handleCsvUpload = vi.fn((_event, onDataLoaded) => {
    onDataLoaded(
      [
        { stimulus: "A", order_a: "1", category: "practice" },
        { stimulus: "B", order_a: "2", category: "main" },
      ],
      ["stimulus", "order_a", "category"],
    );
  });
  hoistedMocks.lastOrdersProps = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const mocks = hoistedMocks;

function LoopsConfigHarness({ loop }: { loop?: Loop }) {
  return <LoopsConfig loop={loop} />;
}

export { installTrialsContext, LoopsConfigHarness, makeLoop, mocks };
export type { Loop };
