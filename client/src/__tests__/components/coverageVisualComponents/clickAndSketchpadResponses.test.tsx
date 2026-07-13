import {
  ClickResponseComponent,
  SketchpadComponent,
  describe,
  expect,
  it,
  render,
  screen,
  shape,
  value,
  vi,
} from "./testHarness";

describe("TrialDesigner visual components", () => {
  it("renders primitive config values for click and sketchpad components", () => {
    const baseProps = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };

    const clickRender = render(
      <ClickResponseComponent
        {...baseProps}
        shapeProps={shape("ClickResponseComponent", {
          capture_full_screen: false,
          show_click_marker: true,
          marker_color: "#00ff00",
        })}
      />,
    );
    expect(screen.getByText(/Click Response/)).toBeInTheDocument();
    clickRender.unmount();

    render(
      <SketchpadComponent
        {...baseProps}
        shapeProps={shape("SketchpadComponent", {
          canvas_shape: "circle",
          canvas_diameter: 140,
          stroke_color: "#00ff00",
        })}
      />,
    );
    expect(screen.getByText(/140/)).toBeInTheDocument();
  });

  it("renders click response defaults with natural dimensions and no marker", () => {
    render(
      <ClickResponseComponent
        shapeProps={shape(
          "ClickResponseComponent",
          { marker_color: value(null) },
          { width: 0, height: 0, rotation: undefined },
        )}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onGuidesChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Click Response \(Full Screen\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("No marker")).toBeInTheDocument();
  });

  it.each([
    {
      name: "bordered circle",
      selected: true,
      config: {
        canvas_shape: value("circle"),
        canvas_diameter: value(180),
        canvas_border_width: value(3),
      },
      overrides: {},
    },
    {
      name: "bordered natural rectangle",
      selected: true,
      config: {
        canvas_shape: value("rectangle"),
        canvas_width: value(240),
        canvas_height: value(160),
        canvas_border_width: value(2),
        stroke_width: value(null),
      },
      overrides: { width: 0, height: 0, rotation: undefined },
    },
    {
      name: "selected borderless rectangle",
      selected: true,
      config: {
        canvas_shape: "rectangle",
        canvas_border_width: 0,
      },
      overrides: {},
    },
    {
      name: "unselected borderless rectangle",
      selected: false,
      config: {
        canvas_shape: "rectangle",
        canvas_border_width: 0,
      },
      overrides: {},
    },
  ])("renders $name", ({ selected, config, overrides }) => {
    const rendered = render(
      <SketchpadComponent
        shapeProps={shape("SketchpadComponent", config, overrides)}
        isSelected={selected}
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onGuidesChange={vi.fn()}
      />,
    );

    expect(rendered.container.firstChild).toBeTruthy();
    rendered.unmount();
  });
});
