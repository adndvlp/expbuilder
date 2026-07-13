import {
  EditorHitBox,
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

  it("handles selection, drag, double-click activation and transforms", async () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const onActivateDom = vi.fn();
    const onGuidesChange = vi.fn();

    render(
      <EditorHitBox
        shapeProps={component("SurveyComponent", {
          id: "survey-a",
          config: {
            min_width: { source: "typed", value: "300px" },
          },
        })}
        canvasStyles={{
          width: 500,
          height: 400,
          fullScreen: false,
          progressBar: false,
          backgroundColor: "#fff",
        }}
        isSelected
        onSelect={onSelect}
        onChange={onChange}
        onActivateDom={onActivateDom}
        onGuidesChange={onGuidesChange}
      />,
    );

    fireEvent.click(screen.getByText("select group"));
    fireEvent.click(screen.getByText("double group"));
    fireEvent.click(screen.getByText("drag move"));
    fireEvent.click(screen.getByText("drag end"));
    fireEvent.click(screen.getByText("transform end"));
    fireEvent.click(screen.getByText("bound small"));
    fireEvent.click(screen.getByText("bound large"));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalled();
      expect(onActivateDom).toHaveBeenCalled();
      expect(onGuidesChange).toHaveBeenCalledWith([]);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
        }),
      );
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            min_width: expect.objectContaining({
              source: "typed",
            }),
          }),
        }),
      );
    });
  });

  it("returns null when the component is not part of the html scene", () => {
    const { container } = render(
      <EditorHitBox
        shapeProps={component("AudioComponent")}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
