import {
  FileUploadResponseComponent,
  InputResponseComponent,
  SliderResponseComponent,
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
  it("renders slider response config fallbacks and unselected state", () => {
    const baseProps = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const cases = [
      shape(
        "SliderResponseComponent",
        {},
        { width: 0, height: 0, rotation: undefined },
      ),
      shape("SliderResponseComponent", {
        min: { source: "csv", value: 0 },
        max: 120,
        slider_start: value([60]),
        labels: value("Low, High"),
        require_movement: value(false),
      }),
      shape("SliderResponseComponent", {
        min: value({ invalid: true }),
        max: { value: 100 },
        slider_start: 50,
        labels: value(12),
      }),
      shape("SliderResponseComponent", {
        min: value(10),
        max: value(10),
        slider_start: value(10),
        labels: "Solo",
      }),
    ];

    for (const shapeProps of cases) {
      const { unmount } = render(
        <SliderResponseComponent {...baseProps} shapeProps={shapeProps} />,
      );

      expect(screen.getByText("Slider Response")).toBeInTheDocument();
      expect(screen.queryByTestId("konva-Transformer")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("renders input response type variants and direct config values", () => {
    const baseProps = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const cases = [
      {
        config: { input_type: value("date") },
        expectedText: "YYYY-MM-DD",
      },
      {
        config: {
          input_type: value("date"),
          placeholder: value("Birthday"),
        },
        expectedText: "Birthday",
      },
      {
        config: { input_type: value("time") },
        expectedText: "HH:MM",
      },
      {
        config: {
          input_type: value("time"),
          placeholder: value("Start"),
        },
        expectedText: "Start",
      },
      {
        config: { input_type: value("datetime-local") },
        expectedText: "YYYY-MM-DD HH:MM",
      },
      {
        config: { input_type: value("number") },
        expectedText: "0",
      },
      {
        config: {
          input_type: value("number"),
          placeholder: value("Age"),
        },
        expectedText: "Age",
      },
      {
        config: {
          input_type: "password",
          placeholder: "Visible placeholder",
          input_font_size: value(null),
          input_border_width: 0,
        },
        expectedText: "••••••",
      },
      {
        config: {
          input_type: value("text"),
          placeholder: value(""),
        },
      },
    ];

    for (const { config, expectedText } of cases) {
      const { unmount } = render(
        <InputResponseComponent
          {...baseProps}
          shapeProps={shape("InputResponseComponent", config)}
        />,
      );

      if (expectedText) {
        expect(screen.getByText(expectedText)).toBeInTheDocument();
      }
      unmount();
    }
  });

  it("renders file upload response config fallbacks and direct values", () => {
    const baseProps = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const cases = [
      {
        config: {},
        expected: "Choose File",
      },
      {
        config: {
          button_label: { source: "none", value: "Ignored" },
          multiple: { source: "none", value: true },
          accept: "raw/*",
        },
        expected: "raw/*",
      },
      {
        config: {
          button_label: value(null),
          multiple: value(null),
          accept: value(null),
        },
        expected: "Choose File",
      },
      {
        config: {
          button_label: "Upload now",
          multiple: false,
          accept: "",
        },
        expected: "Upload now",
      },
    ];

    for (const { config, expected } of cases) {
      const { unmount } = render(
        <FileUploadResponseComponent
          {...baseProps}
          shapeProps={shape("FileUploadResponseComponent", config, {
            width: 0,
            height: 0,
            rotation: undefined,
          })}
        />,
      );

      expect(screen.getByText(expected)).toBeInTheDocument();
      expect(screen.getByText("File Upload")).toBeInTheDocument();
      expect(screen.queryByTestId("konva-Transformer")).not.toBeInTheDocument();
      unmount();
    }
  });
});
