import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Canvas from "../../pages/ExperimentBuilder/components/Canvas";
import type { TimelineItem } from "../../pages/ExperimentBuilder/contexts/TrialsContext";

type MockNode = {
  id: string;
  type: "trial" | "loop";
  data: {
    itemId: string | number;
    name: string;
    expanded: boolean;
    onOpenLoop?: () => void;
  };
};

const mocks = vi.hoisted(() => ({
  trials: {} as Record<string, unknown>,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trials,
}));

vi.mock("reactflow", () => ({
  default: ({ nodes }: { nodes: MockNode[] }) => (
    <div data-testid="react-flow">
      {nodes.map((node) =>
        node.type === "loop" ? (
          <button
            key={node.id}
            type="button"
            aria-label={`toggle-${String(node.data.itemId)}`}
            aria-expanded={node.data.expanded}
            onClick={node.data.onOpenLoop}
          >
            {node.data.name}
          </button>
        ) : (
          <span key={node.id}>{node.data.name}</span>
        ),
      )}
    </div>
  ),
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial",
  () => ({ default: () => null }),
);

const parentItems: TimelineItem[] = [
  { id: 1, type: "trial", name: "Parent first" },
  { id: "nested", type: "loop", name: "Nested loop" },
  { id: 2, type: "trial", name: "Parent last" },
];
const nestedItems: TimelineItem[] = [
  { id: 3, type: "trial", name: "Nested first" },
  { id: 4, type: "trial", name: "Nested last" },
];
const otherItems: TimelineItem[] = [
  { id: 5, type: "trial", name: "Other root first" },
];

describe("unified Canvas loop rendering", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    mocks.trials = {
      timeline: [
        { id: "before", type: "trial", name: "Before" },
        { id: "parent", type: "loop", name: "Parent loop" },
        { id: "other", type: "loop", name: "Other loop" },
        { id: "after", type: "trial", name: "After" },
      ],
      loopTimeline: [],
      activeLoopId: null,
      selectedTrial: null,
      selectedLoop: null,
      setSelectedTrial: vi.fn(),
      setSelectedLoop: vi.fn(),
      getTrial: vi.fn(),
      getLoop: vi.fn(),
      createTrial: vi.fn(),
      createLoop: vi.fn(),
      updateTrial: vi.fn(),
      updateLoop: vi.fn(),
      updateTrialField: vi.fn(),
      updateTimeline: vi.fn(),
      clearLoopTimeline: vi.fn(),
      getLoopTimeline: vi.fn(async (id: string | number) => {
        if (id === "parent") return parentItems;
        if (id === "nested") return nestedItems;
        return otherItems;
      }),
    };
  });

  it("keeps parent and nested loops expanded in one ReactFlow", async () => {
    const { container } = render(<Canvas />);
    expect(screen.getAllByTestId("react-flow")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "toggle-parent" }));
    expect(await screen.findByText("Parent first")).toBeInTheDocument();
    expect(container.querySelector(".canvas-breadcrumb")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("react-flow")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "toggle-nested" }));
    expect(await screen.findByText("Nested first")).toBeInTheDocument();
    expect(screen.getByText("Parent last")).toBeInTheDocument();
    expect(screen.getAllByTestId("react-flow")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "toggle-parent" }));
    await waitFor(() => {
      expect(screen.queryByText("Nested first")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Parent first")).not.toBeInTheDocument();
  });

  it("replaces the expanded route when another root loop opens", async () => {
    render(<Canvas />);

    fireEvent.click(screen.getByRole("button", { name: "toggle-parent" }));
    expect(await screen.findByText("Parent first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "toggle-nested" }));
    expect(await screen.findByText("Nested first")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "toggle-other" }));
    expect(await screen.findByText("Other root first")).toBeInTheDocument();
    expect(screen.queryByText("Parent first")).not.toBeInTheDocument();
    expect(screen.queryByText("Nested first")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("react-flow")).toHaveLength(1);
  });
});
