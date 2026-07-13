import {
  RenderComponentHarness,
  beforeEach,
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

describe("coverage trial designer renderComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders visual components and syncs component config on changes", async () => {
    render(
      <RenderComponentHarness
        initial={component("TextComponent", {
          id: "text-a",
          textFontSize: 16,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("visual-TextComponent-text-a"));

    await waitFor(() => {
      expect(screen.getByTestId("render-selected")).toHaveTextContent("text-a");
      expect(screen.getByTestId("render-state")).toHaveTextContent(
        '"font_size"',
      );
      expect(screen.getByTestId("render-state")).toHaveTextContent('"width"');
      expect(screen.getByTestId("render-state")).toHaveTextContent('"zIndex"');
    });
  });

  it("renders html-scene hit boxes and handles drag, edit and transforms", async () => {
    render(
      <RenderComponentHarness
        initial={component("ButtonResponseComponent", {
          id: "button-a",
          buttonFontSize: 14,
          config: {
            button_font_size: { source: "typed", value: 14 },
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText("select group"));
    fireEvent.click(screen.getByText("double group"));
    fireEvent.click(screen.getByText("drag end"));
    fireEvent.click(screen.getByText("transform end"));

    await waitFor(() => {
      expect(screen.getByTestId("render-selected")).toHaveTextContent(
        "button-a",
      );
      expect(screen.getByTestId("render-state")).toHaveTextContent(
        '"button_font_size"',
      );
      expect(screen.getByTestId("render-state")).toHaveTextContent(
        '"coordinates"',
      );
    });
  });

  it("falls back to a rectangle for unknown component types", async () => {
    render(
      <RenderComponentHarness
        initial={{
          ...(component("AudioComponent") as any),
          id: "unknown-a",
          type: "UnknownComponent",
        }}
        selectedId={null}
      />,
    );

    fireEvent.click(screen.getByTestId("konva-rect-unknown-a"));
    fireEvent.dragEnd(screen.getByTestId("konva-rect-unknown-a"));

    await waitFor(() => {
      expect(screen.getByTestId("render-selected")).toHaveTextContent(
        "unknown-a",
      );
      expect(screen.getByTestId("render-state")).toHaveTextContent(
        '"coordinates"',
      );
    });
  });
});
