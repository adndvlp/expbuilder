import {
  ComponentsSection,
  ResponseComponetsSection,
  afterEach,
  beforeEach,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
} from "./testHarness";

describe("TrialDesigner component metadata and sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders ComponentsSection media empty states and drag payloads", () => {
    const { rerender } = render(
      <ComponentsSection
        type="ImageComponent"
        label="Image"
        images={[]}
        videos={[]}
        audios={[]}
        addComponent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Image"));
    expect(screen.getByText("No images")).toBeInTheDocument();

    rerender(
      <ComponentsSection
        type="VideoComponent"
        label="Video"
        images={[]}
        videos={["uploads/vid/clip.mp4"]}
        audios={[]}
        addComponent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Video"));
    const videoPayload = { setData: vi.fn() };
    fireEvent.dragStart(
      screen.getByText("clip.mp4").parentElement as HTMLElement,
      {
        dataTransfer: videoPayload,
      },
    );
    expect(videoPayload.setData).toHaveBeenCalledWith(
      "fileUrl",
      "uploads/vid/clip.mp4",
    );
    expect(videoPayload.setData).toHaveBeenCalledWith("type", "VideoComponent");

    rerender(
      <ComponentsSection
        type="AudioComponent"
        label="Audio"
        images={[]}
        videos={[]}
        audios={["uploads/aud/tone.mp3"]}
        addComponent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Audio/ }));
    const audioPayload = { setData: vi.fn() };
    fireEvent.dragStart(
      screen.getByText("tone.mp3").parentElement as HTMLElement,
      {
        dataTransfer: audioPayload,
      },
    );
    expect(audioPayload.setData).toHaveBeenCalledWith(
      "fileUrl",
      "uploads/aud/tone.mp3",
    );
    expect(audioPayload.setData).toHaveBeenCalledWith("type", "AudioComponent");

    rerender(
      <ComponentsSection
        type="AudioComponent"
        label="Audio"
        images={[]}
        videos={[]}
        audios={[]}
        addComponent={vi.fn()}
      />,
    );

    expect(screen.getByText("No audio")).toBeInTheDocument();
  });

  it("delegates generic ComponentsSection entries to addComponent with hover states", () => {
    const addComponent = vi.fn();

    render(
      <ComponentsSection
        type="HtmlComponent"
        label="HTML"
        images={[]}
        videos={[]}
        audios={[]}
        addComponent={addComponent}
      />,
    );

    const button = screen.getByText("HTML");
    fireEvent.mouseOver(button);
    expect(button).toHaveStyle({
      background: "#f3f4f6",
      borderColor: "#9ca3af",
    });
    fireEvent.mouseOut(button);
    expect(button).toHaveStyle({
      background: "white",
      borderColor: "#d1d5db",
    });
    fireEvent.click(button);

    expect(addComponent).toHaveBeenCalledWith("HtmlComponent");
  });

  it("filters and toggles response component entries", () => {
    const addComponent = vi.fn();

    render(
      <ResponseComponetsSection
        componentTypes={[
          { type: "TextComponent", label: "Text" },
          { type: "ButtonResponseComponent", label: "Button response" },
          { type: "SliderResponseComponent", label: "Slider response" },
        ]}
        addComponent={addComponent}
      />,
    );

    expect(screen.queryByText("Text")).not.toBeInTheDocument();
    expect(screen.getByText("Button response")).toBeInTheDocument();
    expect(screen.getByText("Slider response")).toBeInTheDocument();

    const responseButton = screen.getByText("Button response");
    fireEvent.mouseOver(responseButton);
    expect(responseButton).toHaveStyle({
      background: "#f3f4f6",
      borderColor: "#9ca3af",
    });
    fireEvent.mouseOut(responseButton);
    expect(responseButton).toHaveStyle({
      background: "white",
      borderColor: "#d1d5db",
    });
    fireEvent.click(responseButton);
    expect(addComponent).toHaveBeenCalledWith("ButtonResponseComponent");

    fireEvent.click(screen.getByRole("button", { name: /Response/ }));
    expect(screen.queryByText("Button response")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Response/ }));
    expect(screen.getByText("Button response")).toBeInTheDocument();
  });
});
