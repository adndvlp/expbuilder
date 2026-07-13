import {
  VideoComponent,
  act,
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
  waitFor,
} from "./testHarness";

describe("TrialDesigner visual components", () => {
  it("renders a captured video frame after seeked metadata is available", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const createdVideos: HTMLVideoElement[] = [];
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName === "video") {
          const video = originalCreateElement("video") as HTMLVideoElement;
          Object.defineProperty(video, "videoWidth", {
            value: 320,
            configurable: true,
          });
          Object.defineProperty(video, "videoHeight", {
            value: 180,
            configurable: true,
          });
          video.addEventListener = vi.fn((eventName, listener) => {
            listeners.set(eventName, listener);
          }) as any;
          createdVideos.push(video);
          return video;
        }
        if (tagName === "canvas") {
          const canvas = originalCreateElement("canvas") as HTMLCanvasElement;
          canvas.toDataURL = vi.fn(() => "data:image/png;base64,frame");
          return canvas;
        }
        return originalCreateElement(tagName);
      },
    );

    class MockImage {
      width = 320;
      height = 180;
      private value = "";
      private loadHandler: (() => void) | null = null;

      get onload() {
        return this.loadHandler;
      }

      set onload(nextHandler: (() => void) | null) {
        this.loadHandler = nextHandler;
        if (this.value) {
          this.loadHandler?.();
        }
      }

      get src() {
        return this.value;
      }

      set src(nextValue: string) {
        this.value = nextValue;
        this.loadHandler?.();
      }
    }

    vi.stubGlobal("Image", MockImage);
    const onChange = vi.fn();
    const { rerender } = render(
      <VideoComponent
        shapeProps={shape(
          "VideoComponent",
          { stimulus: value(["clip.mp4"]) },
          { width: undefined, height: undefined },
        )}
        uploadedFiles={[{ name: "clip.mp4", path: "clip.mp4" }]}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );

    await act(async () => {
      const loadedData = listeners.get("loadeddata");
      const seeked = listeners.get("seeked");
      if (typeof loadedData === "function") loadedData(new Event("loadeddata"));
      if (typeof seeked === "function") seeked(new Event("seeked"));
      await Promise.resolve();
    });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Image transform end"));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 448,
          height: 234,
          rotation: 4,
        }),
      );
    });
    fireEvent.click(screen.getByText("Image drag move"));
    fireEvent.click(screen.getByText("Image drag end"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: 110, y: 132 }),
    );
    fireEvent.click(screen.getByText("Transformer bound small"));
    fireEvent.click(screen.getByText("Transformer bound large"));
    expect(createdVideos[0]?.src).toContain("/mapped/clip.mp4");

    rerender(
      <VideoComponent
        shapeProps={shape(
          "VideoComponent",
          { stimulus: value(["clip.mp4"]) },
          { width: 160, height: 90, rotation: 0 },
        )}
        uploadedFiles={[{ name: "clip.mp4", path: "clip.mp4" }]}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("konva-Image")).toBeInTheDocument();
  });

  it("skips video frame capture when canvas context is unavailable", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName === "video") {
          const video = originalCreateElement("video") as HTMLVideoElement;
          video.pause = vi.fn();
          video.addEventListener = vi.fn((eventName, listener) => {
            listeners.set(eventName, listener);
          }) as any;
          return video;
        }
        if (tagName === "canvas") {
          const canvas = originalCreateElement("canvas") as HTMLCanvasElement;
          canvas.getContext = vi.fn(() => null) as any;
          return canvas;
        }
        return originalCreateElement(tagName);
      },
    );

    render(
      <VideoComponent
        shapeProps={shape("VideoComponent", { stimulus: value("clip.mp4") })}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    await act(async () => {
      const seeked = listeners.get("seeked");
      if (typeof seeked === "function") seeked(new Event("seeked"));
      await Promise.resolve();
    });
    expect(screen.getByTestId("konva-Image")).toBeInTheDocument();
  });

  it("handles video stimulus config fallbacks and direct URLs", () => {
    const originalCreateElement = document.createElement.bind(document);
    const createdVideos: HTMLVideoElement[] = [];
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName === "video") {
          const video = originalCreateElement("video") as HTMLVideoElement;
          video.pause = vi.fn();
          video.addEventListener = vi.fn() as any;
          createdVideos.push(video);
          return video;
        }
        return originalCreateElement(tagName);
      },
    );

    const props = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
    };
    const { rerender } = render(
      <VideoComponent
        {...props}
        shapeProps={shape("VideoComponent", {}, { rotation: 0 })}
      />,
    );
    expect(createdVideos).toHaveLength(0);

    rerender(
      <VideoComponent
        {...props}
        shapeProps={shape("VideoComponent", {
          stimulus: "http://cdn.test/clip.mp4",
        })}
      />,
    );
    expect(createdVideos[0].src).toBe("http://cdn.test/clip.mp4");

    rerender(
      <VideoComponent
        {...props}
        shapeProps={shape("VideoComponent", { stimulus: value("") })}
      />,
    );
    expect(createdVideos).toHaveLength(1);

    rerender(
      <VideoComponent
        {...props}
        shapeProps={shape("VideoComponent", { stimulus: value("local.mp4") })}
      />,
    );
    expect(createdVideos[1].src).toContain("/local.mp4");
  });

  it("ignores video transforms while both frame and placeholder are unavailable", () => {
    imageMockState.loaded = false;
    const onChange = vi.fn();

    render(
      <VideoComponent
        shapeProps={shape("VideoComponent", { stimulus: value("") })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Image transform end"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
