import {
  ImageComponent,
  describe,
  expect,
  fireEvent,
  imageMockState,
  it,
  render,
  screen,
  shape,
  vi,
} from "./testHarness";

describe("TrialDesigner visual components", () => {
  it("uses placeholder image interactions when an image stimulus is missing", () => {
    const onChange = vi.fn();
    const onGuidesChange = vi.fn();
    render(
      <ImageComponent
        shapeProps={shape("ImageComponent", {}, { width: 0, height: 0 })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={onGuidesChange}
      />,
    );

    fireEvent.click(screen.getByText("Image drag move"));
    expect(onGuidesChange).toHaveBeenCalledWith([
      { orientation: "vertical", position: 100 },
    ]);

    fireEvent.click(screen.getByText("Image drag end"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: 110, y: 132 }),
    );
    expect(onGuidesChange).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByText("Image transform end"));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 168,
        height: 117,
        rotation: 4,
      }),
    );
    fireEvent.click(screen.getByText("Transformer bound small"));
    fireEvent.click(screen.getByText("Transformer bound large"));
  });

  it("handles direct image URLs, unselected state and missing image transforms", () => {
    const baseProps = {
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const { unmount } = render(
      <ImageComponent
        {...baseProps}
        shapeProps={shape(
          "ImageComponent",
          { stimulus: "https://cdn.test/image.png" },
          { width: 40, height: 30, rotation: undefined },
        )}
        isSelected={false}
      />,
    );

    fireEvent.click(screen.getByText("Image click"));
    fireEvent.click(screen.getByText("Image drag move"));
    fireEvent.click(screen.getByText("Image drag end"));
    expect(baseProps.onSelect).toHaveBeenCalled();
    expect(baseProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: 110, y: 132 }),
    );
    expect(screen.queryByTestId("konva-Transformer")).not.toBeInTheDocument();
    unmount();

    const csvImage = render(
      <ImageComponent
        {...baseProps}
        shapeProps={shape("ImageComponent", {
          stimulus: { source: "csv", value: "csv-image.png" },
        })}
        isSelected={false}
      />,
    );
    expect(csvImage.container.firstChild).toBeTruthy();
    csvImage.unmount();

    const sizedPlaceholder = render(
      <ImageComponent
        {...baseProps}
        shapeProps={shape(
          "ImageComponent",
          {},
          { width: 80, height: 60, rotation: undefined },
        )}
        isSelected={false}
      />,
    );
    expect(sizedPlaceholder.container.firstChild).toBeTruthy();
    sizedPlaceholder.unmount();

    imageMockState.loaded = false;
    const onChange = vi.fn();
    render(
      <ImageComponent
        shapeProps={shape("ImageComponent", {}, { width: 0, height: 0 })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Image transform end"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
