import {
  EditorHitBox,
  TrialComponent,
  afterEach,
  component,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
  waitFor,
} from "./testHarness";

describe("coverage trial designer EditorHitBox", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("flushes throttled drag moves and cancels pending frames on unmount", () => {
    const callbacks: FrameRequestCallback[] = [];
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const onChange = vi.fn();
    const { unmount } = render(
      <EditorHitBox
        shapeProps={component("SurveyComponent", { id: "drag-frame" })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("drag move"));
    fireEvent.click(screen.getByText("drag move"));

    expect(callbacks).toHaveLength(1);
    callbacks[0](0);
    callbacks[0](1);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ __transient: true }),
    );

    fireEvent.click(screen.getByText("drag move"));
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
  });

  it("starts text editing on text component double click", () => {
    const onEditText = vi.fn();
    const onActivateDom = vi.fn();

    render(
      <EditorHitBox
        shapeProps={component("TextComponent", {
          id: "text-hitbox",
          config: {
            font_size: { source: "typed", value: "bad-size" },
          },
        })}
        isSelected
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onEditText={onEditText}
        onActivateDom={onActivateDom}
      />,
    );

    fireEvent.click(screen.getByText("double group"));

    expect(onEditText).toHaveBeenCalled();
    expect(onActivateDom).not.toHaveBeenCalled();
  });

  it.each([
    [
      "SketchpadComponent",
      { config: { canvas_shape: { source: "typed", value: "circle" } } },
      "canvas_diameter",
    ],
    [
      "SketchpadComponent",
      {
        id: "sketch-rect",
        config: { canvas_shape: { source: "typed", value: "rectangle" } },
      },
      "canvas_width",
    ],
    ["HtmlComponent", {}, '"width":0'],
    ["FileUploadResponseComponent", {}, '"height":0'],
    [
      "InputResponseComponent",
      { config: { input_font_size: { source: "typed", value: "bad-size" } } },
      "inputFontSize",
    ],
    [
      "TextComponent",
      { config: { font_size: { source: "typed", value: "bad-size" } } },
      "textFontSize",
    ],
    [
      "ButtonResponseComponent",
      { config: { button_font_size: { source: "typed", value: "bad-size" } } },
      "buttonFontSize",
    ],
    ["SliderResponseComponent", {}, '"width"'],
  ] as const)(
    "transforms %s hit boxes through type-specific sizing",
    async (type, overrides, expectedKey) => {
      const onChange = vi.fn();

      render(
        <EditorHitBox
          shapeProps={component(type as TrialComponent["type"], {
            id: `${type}-transform`,
            ...overrides,
          })}
          isSelected
          onSelect={vi.fn()}
          onChange={onChange}
        />,
      );

      fireEvent.click(screen.getByText("transform end"));

      await waitFor(() => {
        expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain(
          expectedKey,
        );
      });
    },
  );

  it("renders unselected hit boxes without transformer decoration", () => {
    render(
      <EditorHitBox
        shapeProps={component("SurveyComponent", { id: "unselected-hitbox" })}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("konva-transformer")).not.toBeInTheDocument();
    expect(screen.getByText("select group")).toBeInTheDocument();
  });
});
