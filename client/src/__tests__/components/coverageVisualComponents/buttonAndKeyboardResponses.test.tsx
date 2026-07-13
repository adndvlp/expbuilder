import {
  ButtonResponseComponent,
  KeyboardResponseComponent,
  describe,
  expect,
  fireEvent,
  imageMockState,
  it,
  render,
  screen,
  shape,
  value,
  vi,
} from "./testHarness";

describe("TrialDesigner visual components", () => {
  it("renders button response fallback choices, direct config values and unselected state", () => {
    const baseProps = {
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const emptyChoice = { toString: () => "" };
    const cases = [
      {
        config: {
          choices: { source: "none", value: ["ignored"] },
          grid_rows: { source: "none", value: 3 },
          button_color: { source: "none", value: "#123456" },
        },
        overrides: { width: 0, height: 0, rotation: undefined },
        selected: false,
      },
      {
        config: {
          choices: value("   "),
          grid_rows: value(Number.NaN),
          grid_columns: value(2),
          button_text_color: "#111111",
          button_font_size: 12,
          button_border_radius: 6,
          button_border_color: "#222222",
          button_border_width: 0,
        },
        overrides: { width: 0, height: 0 },
        selected: true,
      },
      {
        config: {
          choices: "Direct Choice",
          grid_rows: 1,
          grid_columns: 1,
        },
        overrides: {},
        selected: false,
      },
      {
        config: {
          choices: value([emptyChoice, 2]),
          grid_rows: value(1),
          grid_columns: value(2),
          image_button_width: value(null),
          image_button_height: value(null),
        },
        overrides: {},
        selected: true,
      },
    ];

    for (const testCase of cases) {
      const { unmount } = render(
        <ButtonResponseComponent
          {...baseProps}
          shapeProps={shape(
            "ButtonResponseComponent",
            testCase.config,
            testCase.overrides,
          )}
          isSelected={testCase.selected}
        />,
      );

      fireEvent.click(screen.getAllByText("Group drag move")[0]);
      fireEvent.click(screen.getAllByText("Group drag end")[0]);
      if (testCase.selected) {
        fireEvent.click(screen.getAllByText("Group transform end")[0]);
      }
      expect(screen.queryByTestId("konva-Transformer")).toBe(
        testCase.selected ? screen.getByTestId("konva-Transformer") : null,
      );
      unmount();
    }

    imageMockState.loaded = false;
    const csvRender = render(
      <ButtonResponseComponent
        {...baseProps}
        shapeProps={shape("ButtonResponseComponent", {
          choices: { source: "csv", value: "choice_column" },
        })}
        isSelected={false}
      />,
    );
    expect(csvRender.container.firstChild).toBeTruthy();
    csvRender.unmount();
  });

  it("renders keyboard response labels for supported choice formats", () => {
    const cases = [
      [{}, "⌨️ Keyboard Response (All Keys)"],
      [{ choices: value("NO_KEYS") }, "⌨️ Keyboard Response (Disabled)"],
      [{ choices: value(["a", 1, { unsupported: true }]) }, "⌨️ Keys: a, 1, ?"],
      [{ choices: "space" }, "⌨️ Key: space"],
      [
        { choices: value({ unsupported: true }) },
        "⌨️ Keyboard Response (All Keys)",
      ],
      [{ choices: { unsupported: true } }, "⌨️ Keyboard Response (All Keys)"],
      [{ choices: 0 }, "⌨️ Key: 0"],
      [{ choices: true }, "⌨️ Keyboard Response"],
    ] as const;

    for (const [config, expectedText] of cases) {
      const { unmount } = render(
        <KeyboardResponseComponent
          shapeProps={shape("KeyboardResponseComponent", config)}
          isSelected={false}
          onSelect={vi.fn()}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByText(expectedText)).toBeInTheDocument();
      unmount();
    }

    const { unmount } = render(
      <KeyboardResponseComponent
        shapeProps={shape(
          "KeyboardResponseComponent",
          {},
          { width: 0, height: 0, rotation: 0 },
        )}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText("⌨️ Keyboard Response (All Keys)"),
    ).toBeInTheDocument();
    unmount();
  });
});
