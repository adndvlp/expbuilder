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

  it("adds new sidebar components with unique names, coordinates and z-index", () => {
    vi.spyOn(Date, "now").mockReturnValue(12345);

    function Harness() {
      const [components, setComponents] = useState<TrialComponent[]>([
        {
          id: "existing-text",
          type: "TextComponent",
          x: 10,
          y: 10,
          width: 0,
          height: 0,
          zIndex: 4,
          config: {
            name: { source: "typed", value: "TextComponent_1" },
          },
        },
      ]);
      const [selectedId, setSelectedId] = useState<string | null>(null);

      return (
        <>
          <LeftSideBar
            {...defaultSidebarProps}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
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

    fireEvent.click(screen.getByText("Text"));

    const state = JSON.parse(screen.getByTestId("state").textContent || "{}");
    expect(state.selectedId).toBe("TextComponent-12345");
    expect(state.components[1]).toEqual({
      id: "TextComponent-12345",
      type: "TextComponent",
      x: 500,
      y: 300,
      width: 0,
      height: 0,
      zIndex: 5,
      config: {
        label: { source: "typed", value: "TextComponent" },
        name: { source: "typed", value: "TextComponent_2" },
        coordinates: { source: "typed", value: { x: 12, y: -5 } },
        zIndex: { source: "typed", value: 5 },
      },
    });
  });

  it("adds sidebar component types with their expected default dimensions", () => {
    let now = 2000;
    vi.spyOn(Date, "now").mockImplementation(() => now++);

    function Harness() {
      const [components, setComponents] = useState<TrialComponent[]>([
        {
          id: "existing",
          type: "TextComponent",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          zIndex: 2,
          config: {},
        },
        {
          id: "existing-without-z-index",
          type: "AudioComponent",
          x: 0,
          y: 0,
          width: 200,
          height: 50,
          config: {},
        },
      ]);
      const [selectedId, setSelectedId] = useState<string | null>(null);

      return (
        <>
          <LeftSideBar
            {...defaultSidebarProps}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
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

    fireEvent.click(screen.getByRole("button", { name: /Stimulus/ }));
    expect(screen.queryByText("Image")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Stimulus/ }));

    for (const label of [
      "Slider",
      "Sketchpad",
      "Survey",
      "File Upload",
      "Button",
      "Text",
      "HTML",
      "Input",
    ]) {
      fireEvent.click(screen.getByText(label));
    }

    const state = JSON.parse(screen.getByTestId("state").textContent || "{}");
    const byType = Object.fromEntries(
      state.components.map((component: TrialComponent) => [
        component.type,
        component,
      ]),
    );

    expect(byType.SliderResponseComponent).toMatchObject({
      width: 250,
      height: 100,
    });
    expect(byType.InputResponseComponent).toMatchObject({
      width: 200,
      height: 50,
    });
    for (const type of [
      "SketchpadComponent",
      "SurveyComponent",
      "FileUploadResponseComponent",
      "ButtonResponseComponent",
      "TextComponent",
      "HtmlComponent",
    ]) {
      expect(byType[type]).toMatchObject({ width: 0, height: 0 });
    }
    expect(state.selectedId).toMatch(/^InputResponseComponent-/);
    expect(byType.InputResponseComponent.config.zIndex.value).toBe(10);
  });
});
