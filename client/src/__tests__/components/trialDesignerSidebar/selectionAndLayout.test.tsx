import {
  LeftSideBar,
  afterEach,
  beforeEach,
  defaultSidebarProps,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  useState,
  vi,
} from "./testHarness";
import type { TrialComponent } from "./testHarness";

describe("TrialDesigner component metadata and sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes the selected sidebar component", () => {
    function Harness() {
      const [components, setComponents] = useState<TrialComponent[]>([
        {
          id: "selected-button",
          type: "ButtonResponseComponent",
          x: 10,
          y: 10,
          width: 0,
          height: 0,
          config: {},
        },
      ]);
      const [selectedId, setSelectedId] = useState<string | null>(
        "selected-button",
      );
      const [selectedIds, setSelectedIds] = useState<string[]>([]);

      return (
        <>
          <LeftSideBar
            {...defaultSidebarProps}
            selectedId={selectedId}
            selectedIds={selectedIds}
            setSelectedId={setSelectedId}
            setSelectedIds={setSelectedIds}
            components={components}
            setComponents={setComponents}
          />
          <pre data-testid="state">
            {JSON.stringify({ components, selectedId })}
          </pre>
        </>
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByText("Delete Selected"));

    const state = JSON.parse(screen.getByTestId("state").textContent || "{}");
    expect(state).toEqual({ components: [], selectedId: null });
  });

  it("resizes, hides and restores the left sidebar handle state", () => {
    const isResizingLeft = { current: false };
    const setShowLeftPanel = vi.fn();
    const setLeftPanelWidth = vi.fn();

    const { container } = render(
      <LeftSideBar
        {...defaultSidebarProps}
        isResizingLeft={isResizingLeft}
        setShowLeftPanel={setShowLeftPanel}
        setLeftPanelWidth={setLeftPanelWidth}
        selectedId={null}
        setSelectedId={vi.fn()}
        components={[]}
        setComponents={vi.fn()}
      />,
    );

    const resizeHandle = container.querySelector<HTMLElement>(
      'div[style*="col-resize"]',
    )!;
    fireEvent.mouseOver(resizeHandle);
    expect(resizeHandle).toHaveStyle({ background: "#000" });
    fireEvent.mouseOut(resizeHandle);
    expect(resizeHandle.style.background).toBe("transparent");

    fireEvent.mouseDown(resizeHandle);
    expect(isResizingLeft.current).toBe(true);

    fireEvent.mouseMove(document, { clientX: 360 });
    expect(setLeftPanelWidth).toHaveBeenCalledWith(340);
    expect(setShowLeftPanel).toHaveBeenCalledWith(true);

    fireEvent.mouseMove(document, { clientX: 120 });
    expect(setShowLeftPanel).toHaveBeenCalledWith(false);

    fireEvent.mouseUp(document);
    expect(isResizingLeft.current).toBe(false);

    fireEvent.mouseMove(document, { clientX: 500 });
    expect(setLeftPanelWidth).toHaveBeenCalledTimes(1);
  });

  it("deletes all selected sidebar components when multi-selection is active", () => {
    function Harness() {
      const [components, setComponents] = useState<TrialComponent[]>([
        {
          id: "a",
          type: "TextComponent",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          config: {},
        },
        {
          id: "b",
          type: "TextComponent",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          config: {},
        },
        {
          id: "c",
          type: "TextComponent",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          config: {},
        },
      ]);
      const [selectedId, setSelectedId] = useState<string | null>(null);
      const [selectedIds, setSelectedIds] = useState<string[]>(["a", "c"]);

      return (
        <>
          <LeftSideBar
            {...defaultSidebarProps}
            selectedId={selectedId}
            selectedIds={selectedIds}
            setSelectedId={setSelectedId}
            setSelectedIds={setSelectedIds}
            components={components}
            setComponents={setComponents}
          />
          <pre data-testid="state">
            {JSON.stringify({ components, selectedId, selectedIds })}
          </pre>
        </>
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByText("Delete Selected"));

    const state = JSON.parse(screen.getByTestId("state").textContent || "{}");
    expect(
      state.components.map((component: TrialComponent) => component.id),
    ).toEqual(["b"]);
    expect(state.selectedId).toBeNull();
    expect(state.selectedIds).toEqual([]);
  });
});
