import {
  AudioComponent,
  AudioResponseComponent,
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
  it("ignores audio transforms before the speaker image is available", () => {
    imageMockState.loaded = false;
    const onChange = vi.fn();

    render(
      <AudioComponent
        shapeProps={shape("AudioComponent")}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Image transform end"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses the loaded speaker dimensions when audio dimensions are absent", () => {
    const rendered = render(
      <AudioComponent
        shapeProps={shape(
          "AudioComponent",
          {},
          {
            width: 0,
            height: 0,
            rotation: undefined,
          },
        )}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onGuidesChange={vi.fn()}
      />,
    );

    expect(rendered.container.firstChild).toBeTruthy();
  });

  it("renders audio response config variants and unselected state", () => {
    const baseProps = {
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const cases = [
      {
        config: {
          show_done_button: value(false),
          done_button_label: { source: "none", value: "Ignored" },
          allow_playback: true,
        },
        overrides: { width: 0, height: 0, rotation: undefined },
        selected: false,
      },
      {
        config: {
          show_done_button: { source: "csv", value: true },
          done_button_label: "Done",
          allow_playback: value(true),
        },
        overrides: { width: 120, height: 100 },
        selected: true,
      },
    ];

    for (const testCase of cases) {
      const { unmount } = render(
        <AudioResponseComponent
          {...baseProps}
          shapeProps={shape(
            "AudioResponseComponent",
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
  });

  it("preserves direct false audio response config and defaults null values", () => {
    render(
      <AudioResponseComponent
        shapeProps={shape("AudioResponseComponent", {
          show_done_button: false,
          done_button_label: { source: "typed", value: null },
          allow_playback: { source: "typed", value: null },
        })}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onGuidesChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Continue")).not.toBeInTheDocument();
    expect(screen.queryByText("✓ Playback enabled")).not.toBeInTheDocument();
  });
});
