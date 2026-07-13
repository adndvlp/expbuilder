import {
  TextComponent,
  describe,
  expect,
  fireEvent,
  it,
  konvaMockState,
  render,
  screen,
  shape,
  value,
  vi,
} from "./testHarness";

describe("TrialDesigner visual components", () => {
  it("selects text on first click and tolerates missing resize refs", () => {
    const onSelect = vi.fn();
    const onEditStart = vi.fn();
    const { unmount } = render(
      <TextComponent
        shapeProps={shape("TextComponent", {
          text: value("Plain text"),
          font_size: value(18),
        })}
        isSelected={false}
        onSelect={onSelect}
        onChange={vi.fn()}
        onEditStart={onEditStart}
      />,
    );

    fireEvent.click(screen.getByText("Group click"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onEditStart).not.toHaveBeenCalled();
    unmount();

    konvaMockState.nullRefNames.add("Rect");
    const onChange = vi.fn();
    render(
      <TextComponent
        shapeProps={shape("TextComponent", {
          text: value("Resize guard"),
          font_size: value(18),
        })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );

    for (const button of screen.getAllByText("Rect transform")) {
      fireEvent.click(button);
    }
    for (const button of screen.getAllByText("Rect transform end")) {
      fireEvent.click(button);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders cloze text with an empty segment and a border-only background", () => {
    const { container } = render(
      <TextComponent
        shapeProps={shape(
          "TextComponent",
          {
            text: value("%answer%"),
            background_color: value("transparent"),
            border_width: value(1),
            border_color: value("#222222"),
          },
          { rotation: undefined },
        )}
        isSelected
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("handles vertical resizing and transform-end fallback without an active anchor", () => {
    konvaMockState.activeAnchor = "bottom-center";
    const verticalChange = vi.fn();
    const verticalRender = render(
      <TextComponent
        shapeProps={shape("TextComponent", {
          text: value("Plain resize text"),
          font_size: value(18),
        })}
        isSelected
        onSelect={vi.fn()}
        onChange={verticalChange}
      />,
    );

    for (const button of screen.getAllByText("Rect transform")) {
      fireEvent.click(button);
    }
    expect(verticalChange).toHaveBeenCalledWith(
      expect.objectContaining({ __transient: true }),
    );
    verticalRender.unmount();

    konvaMockState.activeAnchor = undefined;
    const finalChange = vi.fn();
    render(
      <TextComponent
        shapeProps={shape("TextComponent", {
          text: value("Scale font text"),
          font_size: value(18),
        })}
        isSelected
        onSelect={vi.fn()}
        onChange={finalChange}
      />,
    );

    for (const button of screen.getAllByText("Rect transform end")) {
      fireEvent.click(button);
    }
    expect(finalChange).toHaveBeenCalledWith(
      expect.objectContaining({
        __transient: undefined,
        textFontSize: expect.any(Number),
      }),
    );
  });
});
